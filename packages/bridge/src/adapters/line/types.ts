/**
 * LINE LIFF specific types.
 */

import type { AdapterConfig } from "../../core/types.ts";

/** Configuration for the LINE LIFF adapter. */
export interface LineAdapterConfig extends AdapterConfig {
  readonly platformOptions?: {
    /** LINE LIFF App ID. */
    readonly liffId?: string;
  };
}

/**
 * Subset of the LIFF SDK API.
 * @see https://developers.line.biz/en/reference/liff/
 */
export interface LiffSdk {
  init(config: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  getAccessToken(): string | null;
  sendMessages(messages: readonly Record<string, unknown>[]): Promise<void>;
  closeWindow(): void;
}
