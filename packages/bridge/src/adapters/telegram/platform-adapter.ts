/**
 * Telegram PlatformAdapter for the MCP Apps Bridge.
 *
 * Implements the high-level PlatformAdapter interface by wrapping the
 * Telegram WebApp SDK. Maps Telegram theme, viewport, and lifecycle
 * events to MCP Apps HostContext and LifecycleEvents.
 *
 * This runs client-side inside the Telegram Mini App WebView.
 */

import type {
  LifecycleEventHandler,
  PlatformAdapter,
} from "../../core/adapter.ts";
import type {
  ContainerDimensions,
  HostContext,
  HostContextStyles,
  LifecycleEvent,
  SafeAreaInsets,
} from "../../core/types.ts";
import type { TelegramThemeParams, TelegramWebApp } from "./types.ts";
import { getTelegramWebApp } from "./sdk-bridge.ts";

/**
 * Maps Telegram WebApp SDK to the MCP Apps PlatformAdapter interface.
 *
 * Usage:
 * ```ts
 * const adapter = new TelegramPlatformAdapter();
 * const client = new BridgeClient({ platform: adapter, ... });
 * ```
 */
export class TelegramPlatformAdapter implements PlatformAdapter {
  readonly name = "telegram" as const;

  private tg: TelegramWebApp | null = null;
  private lifecycleHandlers: LifecycleEventHandler[] = [];
  private boundThemeHandler: (() => void) | null = null;
  private boundViewportHandler: (() => void) | null = null;
  private boundActivatedHandler: (() => void) | null = null;
  private boundDeactivatedHandler: (() => void) | null = null;

  initialize(): Promise<HostContext> {
    this.tg = getTelegramWebApp();

    // Signal to Telegram that the app is ready
    this.tg.ready();

    // Expand to full viewport by default
    if (!this.tg.isExpanded) {
      this.tg.expand();
    }

    // Register event listeners
    this.setupEventListeners();

    return Promise.resolve(this.buildHostContext());
  }

  getTheme(): "light" | "dark" {
    if (!this.tg) {
      throw new Error("[TelegramPlatformAdapter] Not initialized.");
    }
    return this.tg.colorScheme;
  }

  getContainerDimensions(): ContainerDimensions {
    if (!this.tg) {
      throw new Error("[TelegramPlatformAdapter] Not initialized.");
    }
    // deno-lint-ignore no-explicit-any
    const _global = globalThis as any;
    return {
      width: _global.innerWidth ?? 0,
      maxHeight: this.tg.viewportStableHeight,
    };
  }

  onLifecycleEvent(handler: LifecycleEventHandler): void {
    this.lifecycleHandlers.push(handler);
  }

  openLink(url: string): Promise<void> {
    if (!this.tg) {
      throw new Error("[TelegramPlatformAdapter] Not initialized.");
    }
    this.tg.openLink(url);
    return Promise.resolve();
  }

  sendMessage(text: string): Promise<void> {
    if (!this.tg) {
      throw new Error("[TelegramPlatformAdapter] Not initialized.");
    }
    // WARNING: sendData() closes the Mini App!
    this.tg.sendData(text);
    return Promise.resolve();
  }

  getAuthData(): Record<string, unknown> {
    if (!this.tg) {
      throw new Error(
        "[TelegramPlatformAdapter] Not initialized. Call initialize() first.",
      );
    }
    return {
      initData: this.tg.initData,
      initDataUnsafe: this.tg.initDataUnsafe,
      platform: this.tg.platform,
      version: this.tg.version,
    };
  }

  /**
   * Clean up Telegram event listeners.
   * Call this when the bridge is destroyed.
   */
  destroy(): void {
    if (this.tg) {
      if (this.boundThemeHandler) {
        this.tg.offEvent("themeChanged", this.boundThemeHandler);
      }
      if (this.boundViewportHandler) {
        this.tg.offEvent("viewportChanged", this.boundViewportHandler);
      }
      if (this.boundActivatedHandler) {
        this.tg.offEvent("activated", this.boundActivatedHandler);
      }
      if (this.boundDeactivatedHandler) {
        this.tg.offEvent("deactivated", this.boundDeactivatedHandler);
      }
    }
    this.lifecycleHandlers = [];
    this.tg = null;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildHostContext(): HostContext {
    if (!this.tg) {
      throw new Error("[TelegramPlatformAdapter] Not initialized.");
    }

    return {
      theme: this.tg.colorScheme,
      styles: this.buildStyles(this.tg.themeParams),
      containerDimensions: this.getContainerDimensions(),
      platform: "mobile",
      locale: this.getLocale(),
      timeZone: this.getTimeZone(),
      safeAreaInsets: this.buildSafeAreaInsets(),
    };
  }

  private buildStyles(params: TelegramThemeParams): HostContextStyles {
    const variables: Record<string, string> = {};

    if (params.bg_color) {
      variables["--color-background-primary"] = params.bg_color;
    }
    if (params.secondary_bg_color) {
      variables["--color-background-secondary"] = params.secondary_bg_color;
    }
    if (params.text_color) {
      variables["--color-text-primary"] = params.text_color;
    }
    if (params.subtitle_text_color) {
      variables["--color-text-secondary"] = params.subtitle_text_color;
    }
    if (params.section_separator_color) {
      variables["--color-border-primary"] = params.section_separator_color;
    }
    if (params.accent_text_color) {
      variables["--color-ring-primary"] = params.accent_text_color;
    }
    if (params.hint_color) {
      variables["--color-text-hint"] = params.hint_color;
    }
    if (params.link_color) {
      variables["--color-text-link"] = params.link_color;
    }
    if (params.button_color) {
      variables["--color-button-primary"] = params.button_color;
    }
    if (params.button_text_color) {
      variables["--color-button-text"] = params.button_text_color;
    }
    if (params.header_bg_color) {
      variables["--color-background-header"] = params.header_bg_color;
    }
    if (params.section_bg_color) {
      variables["--color-background-section"] = params.section_bg_color;
    }

    return { variables };
  }

  private buildSafeAreaInsets(): SafeAreaInsets {
    const inset = this.tg?.safeAreaInset;
    return {
      top: inset?.top ?? 0,
      right: inset?.right ?? 0,
      bottom: inset?.bottom ?? 0,
      left: inset?.left ?? 0,
    };
  }

  private getLocale(): string {
    // deno-lint-ignore no-explicit-any
    const nav = (globalThis as any).navigator;
    return nav?.language ?? "en";
  }

  private getTimeZone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Intl may not be available in all webview runtimes; UTC is safe default
      return "UTC";
    }
  }

  private setupEventListeners(): void {
    if (!this.tg) return;

    this.boundThemeHandler = () => {
      this.emitLifecycleEvent({ type: "theme-changed" });
    };

    this.boundViewportHandler = () => {
      this.emitLifecycleEvent({ type: "viewport-changed" });
    };

    this.boundActivatedHandler = () => {
      this.emitLifecycleEvent({ type: "activated" });
    };

    this.boundDeactivatedHandler = () => {
      this.emitLifecycleEvent({ type: "deactivated" });
    };

    this.tg.onEvent("themeChanged", this.boundThemeHandler);
    this.tg.onEvent("viewportChanged", this.boundViewportHandler);
    this.tg.onEvent("activated", this.boundActivatedHandler);
    this.tg.onEvent("deactivated", this.boundDeactivatedHandler);
  }

  private emitLifecycleEvent(event: LifecycleEvent): void {
    for (const handler of this.lifecycleHandlers) {
      handler(event);
    }
  }
}
