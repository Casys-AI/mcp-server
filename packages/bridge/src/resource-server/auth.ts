/**
 * Extensible authentication helpers for resource-server WebSocket sessions.
 *
 * Authentication is platform-dependent. The bridge therefore exposes a small
 * handler contract instead of hard-coding Telegram-specific checks.
 */

import type { BridgeSession } from "./session.ts";
import { validateTelegramInitData } from "./telegram-auth.ts";

/** Result returned by a platform auth handler. */
export interface BridgeAuthResult {
  readonly valid: boolean;
  readonly principalId?: string | number;
  readonly username?: string;
  readonly context?: Record<string, unknown>;
  readonly error?: string;
}

/** Platform auth handler invoked on `{ type: "auth", ... }` messages. */
export type BridgeAuthHandler = (
  session: BridgeSession,
  message: Record<string, unknown>,
) => Promise<BridgeAuthResult>;

/**
 * Build an auth handler compatible with Telegram Mini App `initData`.
 *
 * The handler accepts both legacy `{ type, initData }` and extensible
 * `{ type, payload: { initData } }` message shapes.
 */
export function createTelegramAuthHandler(
  botToken: string,
): BridgeAuthHandler {
  return async (_session, message) => {
    const payload = isRecord(message.payload) ? message.payload : message;
    const initData = typeof payload.initData === "string"
      ? payload.initData
      : typeof message.initData === "string"
      ? message.initData
      : null;

    if (!initData) {
      return {
        valid: false,
        error: "Missing Telegram initData in auth payload.",
      };
    }

    const result = await validateTelegramInitData(initData, botToken);
    return {
      valid: result.valid,
      principalId: result.userId,
      username: result.username,
      context: result.valid
        ? {
            provider: "telegram",
            userId: result.userId,
            username: result.username,
          }
        : undefined,
      error: result.error,
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
