import { assertEquals, assertThrows } from "@std/assert";
import { TelegramAdapter } from "../../src/adapters/telegram/adapter.ts";
import { TelegramPlatformAdapter } from "../../src/adapters/telegram/platform-adapter.ts";
import type { TelegramWebApp } from "../../src/adapters/telegram/types.ts";
import type { LifecycleEvent } from "../../src/core/types.ts";

// ---------------------------------------------------------------------------
// Low-level TelegramAdapter tests (McpAppsAdapter)
// ---------------------------------------------------------------------------

Deno.test("TelegramAdapter - platform identifier", () => {
  const adapter = new TelegramAdapter();
  assertEquals(adapter.platform, "telegram");
});

Deno.test("TelegramAdapter - sendToHost throws before init", () => {
  const adapter = new TelegramAdapter();
  assertThrows(
    () =>
      adapter.sendToHost({
        jsonrpc: "2.0",
        id: 1,
        method: "test",
      }),
    Error,
    "Not initialized",
  );
});

Deno.test("TelegramAdapter - init + destroy lifecycle", async () => {
  const adapter = new TelegramAdapter();
  await adapter.init({ resourceBaseUrl: "http://localhost:8080" });
  adapter.destroy();
});

Deno.test("TelegramAdapter - double init throws", async () => {
  const adapter = new TelegramAdapter();
  await adapter.init({ resourceBaseUrl: "http://localhost:8080" });
  try {
    await adapter.init({ resourceBaseUrl: "http://localhost:8080" });
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Already initialized"), true);
  } finally {
    adapter.destroy();
  }
});

// ---------------------------------------------------------------------------
// Mock Telegram.WebApp SDK
// ---------------------------------------------------------------------------

function createMockTelegramWebApp(): TelegramWebApp & { eventHandlers: Map<string, Set<() => void>> } {
  const eventHandlers = new Map<string, Set<() => void>>();

  return {
    initData: "query_id=test&user=%7B%22id%22%3A123%7D",
    initDataUnsafe: { query_id: "test", user: { id: 123, first_name: "Test" } },
    version: "7.12",
    platform: "android",
    colorScheme: "dark",
    themeParams: {
      bg_color: "#1c1c1e",
      text_color: "#ffffff",
      hint_color: "#7d7d82",
      link_color: "#2481cc",
      button_color: "#2481cc",
      button_text_color: "#ffffff",
      secondary_bg_color: "#2c2c2e",
      accent_text_color: "#2481cc",
      section_separator_color: "#3d3d40",
      subtitle_text_color: "#7d7d82",
    },
    viewportHeight: 700,
    viewportStableHeight: 680,
    isExpanded: false,
    safeAreaInset: { top: 44, bottom: 34, left: 0, right: 0 },

    eventHandlers,

    sendData(_data: string): void {},
    ready(): void {},
    close(): void {},
    expand(): void {},

    openLink(_url: string): void {},

    onEvent(eventType: string, handler: () => void): void {
      if (!eventHandlers.has(eventType)) {
        eventHandlers.set(eventType, new Set());
      }
      eventHandlers.get(eventType)!.add(handler);
    },

    offEvent(eventType: string, handler: () => void): void {
      eventHandlers.get(eventType)?.delete(handler);
    },
  };
}

/** Install mock Telegram SDK on globalThis and return cleanup function. */
function installMockTelegram(): {
  tg: ReturnType<typeof createMockTelegramWebApp>;
  cleanup: () => void;
} {
  const tg = createMockTelegramWebApp();
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  const original = g.Telegram;
  g.Telegram = { WebApp: tg };
  return {
    tg,
    cleanup: () => {
      if (original === undefined) {
        delete g.Telegram;
      } else {
        g.Telegram = original;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// TelegramPlatformAdapter tests
// ---------------------------------------------------------------------------

Deno.test("TelegramPlatformAdapter - name is telegram", () => {
  const adapter = new TelegramPlatformAdapter();
  assertEquals(adapter.name, "telegram");
});

Deno.test("TelegramPlatformAdapter - initialize returns HostContext", async () => {
  const { cleanup } = installMockTelegram();
  try {
    const adapter = new TelegramPlatformAdapter();
    const ctx = await adapter.initialize();

    assertEquals(ctx.theme, "dark");
    assertEquals(ctx.platform, "mobile");
    assertEquals(ctx.safeAreaInsets?.top, 44);
    assertEquals(ctx.safeAreaInsets?.bottom, 34);
    assertEquals(typeof ctx.locale, "string");
    assertEquals(typeof ctx.timeZone, "string");

    // Styles should map Telegram theme params to CSS variables
    assertEquals(ctx.styles?.variables?.["--color-background-primary"], "#1c1c1e");
    assertEquals(ctx.styles?.variables?.["--color-text-primary"], "#ffffff");
    assertEquals(ctx.styles?.variables?.["--color-ring-primary"], "#2481cc");

    adapter.destroy();
  } finally {
    cleanup();
  }
});

Deno.test("TelegramPlatformAdapter - getTheme returns colorScheme", async () => {
  const { cleanup } = installMockTelegram();
  try {
    const adapter = new TelegramPlatformAdapter();
    await adapter.initialize();

    assertEquals(adapter.getTheme(), "dark");

    adapter.destroy();
  } finally {
    cleanup();
  }
});

Deno.test("TelegramPlatformAdapter - getContainerDimensions", async () => {
  const { cleanup } = installMockTelegram();
  try {
    const adapter = new TelegramPlatformAdapter();
    await adapter.initialize();

    const dims = adapter.getContainerDimensions();
    assertEquals(dims.maxHeight, 680); // viewportStableHeight

    adapter.destroy();
  } finally {
    cleanup();
  }
});

Deno.test("TelegramPlatformAdapter - getAuthData returns initData", async () => {
  const { cleanup } = installMockTelegram();
  try {
    const adapter = new TelegramPlatformAdapter();
    await adapter.initialize();

    const auth = adapter.getAuthData();
    assertEquals(typeof auth.initData, "string");
    assertEquals(auth.platform, "android");
    assertEquals(auth.version, "7.12");

    adapter.destroy();
  } finally {
    cleanup();
  }
});

Deno.test("TelegramPlatformAdapter - lifecycle events from Telegram", async () => {
  const { tg, cleanup } = installMockTelegram();
  try {
    const adapter = new TelegramPlatformAdapter();
    await adapter.initialize();

    const events: LifecycleEvent[] = [];
    adapter.onLifecycleEvent((e) => events.push(e));

    // Simulate Telegram themeChanged event
    const themeHandlers = tg.eventHandlers.get("themeChanged");
    assertEquals(themeHandlers !== undefined, true);
    for (const h of themeHandlers!) h();

    assertEquals(events.length, 1);
    assertEquals(events[0]!.type, "theme-changed");

    // Simulate viewportChanged
    const vpHandlers = tg.eventHandlers.get("viewportChanged");
    for (const h of vpHandlers!) h();

    assertEquals(events.length, 2);
    assertEquals(events[1]!.type, "viewport-changed");

    // Simulate activated
    const actHandlers = tg.eventHandlers.get("activated");
    for (const h of actHandlers!) h();

    assertEquals(events.length, 3);
    assertEquals(events[2]!.type, "activated");

    adapter.destroy();
  } finally {
    cleanup();
  }
});

Deno.test("TelegramPlatformAdapter - destroy cleans up event listeners", async () => {
  const { tg, cleanup } = installMockTelegram();
  try {
    const adapter = new TelegramPlatformAdapter();
    await adapter.initialize();

    // Verify handlers are registered
    assertEquals(tg.eventHandlers.get("themeChanged")!.size > 0, true);
    assertEquals(tg.eventHandlers.get("viewportChanged")!.size > 0, true);

    adapter.destroy();

    // After destroy, handlers should be removed
    assertEquals(tg.eventHandlers.get("themeChanged")!.size, 0);
    assertEquals(tg.eventHandlers.get("viewportChanged")!.size, 0);
  } finally {
    cleanup();
  }
});

Deno.test("TelegramPlatformAdapter - openLink calls Telegram.WebApp.openLink", async () => {
  const { tg, cleanup } = installMockTelegram();
  const openedUrls: string[] = [];
  tg.openLink = (url: string) => { openedUrls.push(url); };

  try {
    const adapter = new TelegramPlatformAdapter();
    await adapter.initialize();

    await adapter.openLink("https://example.com");
    assertEquals(openedUrls, ["https://example.com"]);

    adapter.destroy();
  } finally {
    cleanup();
  }
});

Deno.test("TelegramPlatformAdapter - throws if not initialized", () => {
  const adapter = new TelegramPlatformAdapter();

  assertThrows(
    () => adapter.getTheme(),
    Error,
    "Not initialized",
  );

  assertThrows(
    () => adapter.getContainerDimensions(),
    Error,
    "Not initialized",
  );

  assertThrows(
    () => adapter.getAuthData(),
    Error,
    "Not initialized",
  );
});
