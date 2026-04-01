/**
 * Telegram Mini App specific types.
 *
 * @see https://core.telegram.org/bots/webapps
 */

import type { AdapterConfig } from "../../core/types.ts";

/** Configuration for the Telegram Mini App adapter. */
export interface TelegramAdapterConfig extends AdapterConfig {
  readonly platformOptions?: {
    /** Telegram Bot token (used server-side for validation). */
    readonly botToken?: string;
    /** If true, validate `initData` signature from Telegram. Defaults to true. */
    readonly validateInitData?: boolean;
  };
}

/**
 * Telegram WebApp theme parameters.
 * @see https://core.telegram.org/bots/webapps#themeparams
 */
export interface TelegramThemeParams {
  readonly bg_color?: string;
  readonly text_color?: string;
  readonly hint_color?: string;
  readonly link_color?: string;
  readonly button_color?: string;
  readonly button_text_color?: string;
  readonly secondary_bg_color?: string;
  readonly header_bg_color?: string;
  readonly bottom_bar_bg_color?: string;
  readonly accent_text_color?: string;
  readonly section_bg_color?: string;
  readonly section_header_text_color?: string;
  readonly section_separator_color?: string;
  readonly subtitle_text_color?: string;
  readonly destructive_text_color?: string;
  readonly [key: string]: string | undefined;
}

/** Safe area inset values from Telegram. */
export interface TelegramSafeAreaInset {
  readonly top?: number;
  readonly bottom?: number;
  readonly left?: number;
  readonly right?: number;
}

/**
 * Subset of the Telegram WebApp API exposed to Mini Apps.
 * @see https://core.telegram.org/bots/webapps#initializing-mini-apps
 */
export interface TelegramWebApp {
  readonly initData: string;
  readonly initDataUnsafe: Record<string, unknown>;
  readonly version: string;
  readonly platform: string;
  readonly colorScheme: "light" | "dark";
  readonly themeParams: TelegramThemeParams;
  readonly viewportHeight: number;
  readonly viewportStableHeight: number;
  readonly isExpanded: boolean;
  readonly safeAreaInset?: TelegramSafeAreaInset;
  readonly contentSafeAreaInset?: TelegramSafeAreaInset;

  sendData(data: string): void;
  ready(): void;
  close(): void;
  expand(): void;
  requestFullscreen?(): void;

  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink?(url: string): void;

  onEvent(eventType: string, handler: () => void): void;
  offEvent(eventType: string, handler: () => void): void;

  MainButton?: {
    text: string;
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(handler: () => void): void;
    offClick(handler: () => void): void;
  };

  BackButton?: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(handler: () => void): void;
    offClick(handler: () => void): void;
  };
}

/**
 * Telegram event types.
 * @see https://core.telegram.org/bots/webapps#events-available-for-mini-apps
 */
export type TelegramEventType =
  | "themeChanged"
  | "viewportChanged"
  | "mainButtonClicked"
  | "backButtonClicked"
  | "settingsButtonClicked"
  | "invoiceClosed"
  | "popupClosed"
  | "qrTextReceived"
  | "clipboardTextReceived"
  | "writeAccessRequested"
  | "contactRequested"
  | "activated"
  | "deactivated"
  | "fullscreenChanged"
  | "fullscreenFailed"
  | "homeScreenAdded"
  | "homeScreenChecked"
  | "accelerometerStarted"
  | "accelerometerStopped"
  | "accelerometerChanged"
  | "deviceOrientationStarted"
  | "deviceOrientationStopped"
  | "deviceOrientationChanged"
  | "gyroscopeStarted"
  | "gyroscopeStopped"
  | "gyroscopeChanged"
  | "locationManagerUpdated"
  | "locationRequested"
  | "emojiStatusSet"
  | "emojiStatusFailed"
  | "emojiStatusAccessRequested"
  | "fileDownloadRequested"
  | "shareMessageSent"
  | "shareMessageFailed";
