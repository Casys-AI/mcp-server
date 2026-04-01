/**
 * Session management for the resource server.
 *
 * Each connected webview gets a session that tracks:
 * - The platform type
 * - The current tool context (if a tool call is in flight)
 * - Activity timestamps for cleanup
 */

/** A JSON-RPC notification to be sent to the app when the WebSocket connects. */
export interface PendingNotification {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

/** A bridge session representing one connected webview. */
export interface BridgeSession {
  /** Unique session ID. */
  readonly id: string;
  /** Platform identifier (e.g. "telegram", "line"). */
  readonly platform: string;
  /** When the session was created (Unix ms). */
  readonly createdAt: number;
  /** Last activity timestamp (Unix ms). Updated on each message. */
  lastActivity: number;
  /** Whether the session has been authenticated (e.g. Telegram initData validated). */
  authenticated: boolean;
  /** Generic principal identifier returned by the active auth handler. */
  principalId?: string | number;
  /** Telegram user ID (set after successful auth). */
  userId?: number;
  /** Telegram username (set after successful auth). */
  username?: string;
  /** Arbitrary auth context attached by a platform auth handler. */
  authContext?: Record<string, unknown>;
  /** Notifications to send when the WebSocket connects (e.g. tool-result). */
  pendingNotifications?: PendingNotification[];
}

/**
 * In-memory session store.
 *
 * Sessions are created when a webview connects via WebSocket and
 * cleaned up when the connection closes or after a timeout.
 */
export class SessionStore {
  private readonly sessions = new Map<string, BridgeSession>();
  private readonly maxAge: number;

  /** @param maxAgeMs - Session TTL in ms. Defaults to 30 minutes. */
  constructor(maxAgeMs = 30 * 60 * 1000) {
    this.maxAge = maxAgeMs;
  }

  /** Create a new session. */
  create(platform: string): BridgeSession {
    const id = generateSessionId();
    const now = Date.now();
    const session: BridgeSession = {
      id,
      platform,
      createdAt: now,
      lastActivity: now,
      authenticated: false,
    };
    this.sessions.set(id, session);
    return session;
  }

  /** Get a session by ID. Returns undefined if not found or expired. */
  get(id: string): BridgeSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    if (Date.now() - session.lastActivity > this.maxAge) {
      this.sessions.delete(id);
      return undefined;
    }

    return session;
  }

  /** Update the last activity timestamp. */
  touch(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /** Remove a session. */
  remove(id: string): boolean {
    return this.sessions.delete(id);
  }

  /** Remove all expired sessions. */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > this.maxAge) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /** Number of active sessions. */
  get size(): number {
    return this.sessions.size;
  }

  /** Clear all sessions. */
  clear(): void {
    this.sessions.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
