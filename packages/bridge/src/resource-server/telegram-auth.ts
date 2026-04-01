/**
 * Telegram Mini App initData HMAC-SHA256 server-side validation.
 *
 * Implements the algorithm documented at:
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Uses the Web Crypto API exclusively (works in Deno and Node.js 18+).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of validating Telegram initData. */
export interface TelegramAuthResult {
  /** Whether the initData is valid. */
  readonly valid: boolean;
  /** Telegram user ID (from the `user` JSON field). */
  readonly userId?: number;
  /** Telegram username. */
  readonly username?: string;
  /** User's first name. */
  readonly firstName?: string;
  /** User's last name. */
  readonly lastName?: string;
  /** Parsed auth_date as a Date object. */
  readonly authDate?: Date;
  /** Human-readable error message when valid is false. */
  readonly error?: string;
}

/** Default maximum age for auth_date: 24 hours. */
const DEFAULT_MAX_AGE_SECONDS = 86_400;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate Telegram Mini App `initData`.
 *
 * Algorithm:
 *  1. Parse the initData query string.
 *  2. Extract and remove the `hash` parameter.
 *  3. Sort remaining key=value pairs alphabetically by key.
 *  4. Join them with `\n` to form data_check_string.
 *  5. Derive secret_key = HMAC-SHA256(key="WebAppData", data=botToken).
 *  6. Compute expected = HMAC-SHA256(key=secret_key, data=data_check_string).
 *  7. Compare hex(expected) with hash using constant-time comparison.
 *  8. Check auth_date freshness.
 *
 * @param initData - The raw initData query string from Telegram.
 * @param botToken - The bot token used to sign the data.
 * @param maxAgeSeconds - Maximum acceptable age of auth_date. Defaults to 86400 (24h).
 * @returns A promise resolving to the validation result.
 */
export async function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = DEFAULT_MAX_AGE_SECONDS,
): Promise<TelegramAuthResult> {
  // -----------------------------------------------------------------------
  // 1. Input validation (fail-fast)
  // -----------------------------------------------------------------------
  if (!initData || typeof initData !== "string") {
    return { valid: false, error: "initData is required and must be a non-empty string" };
  }
  if (!botToken || typeof botToken !== "string") {
    throw new Error(
      "[telegram-auth] botToken is required. " +
      "Provide the Telegram Bot token for HMAC-SHA256 validation.",
    );
  }

  // -----------------------------------------------------------------------
  // 2. Parse query string and extract hash
  // -----------------------------------------------------------------------
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) {
    return { valid: false, error: "Missing 'hash' parameter in initData" };
  }

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) {
    return { valid: false, error: "Missing 'auth_date' parameter in initData" };
  }

  const authDateUnix = parseInt(authDateRaw, 10);
  if (isNaN(authDateUnix)) {
    return { valid: false, error: "Invalid 'auth_date' parameter: not a valid integer" };
  }

  // -----------------------------------------------------------------------
  // 3. Build data_check_string: sorted key=value pairs excluding `hash`
  // -----------------------------------------------------------------------
  params.delete("hash");

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();

  const dataCheckString = pairs.join("\n");

  // -----------------------------------------------------------------------
  // 4. Compute HMAC-SHA256 and compare
  // -----------------------------------------------------------------------
  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    new TextEncoder().encode(botToken),
  );

  const receivedHashBytes = hexToBytes(receivedHash);
  if (!receivedHashBytes) {
    return { valid: false, error: "Invalid 'hash' parameter: not valid hex" };
  }

  // Use crypto.subtle.verify for inherently timing-safe comparison
  const verifyKey = await crypto.subtle.importKey(
    "raw",
    secretKey as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const isValid = await crypto.subtle.verify(
    "HMAC",
    verifyKey,
    receivedHashBytes as unknown as ArrayBuffer,
    new TextEncoder().encode(dataCheckString) as unknown as ArrayBuffer,
  );

  if (!isValid) {
    return { valid: false, error: "HMAC-SHA256 hash mismatch: initData signature is invalid" };
  }

  // -----------------------------------------------------------------------
  // 5. Check auth_date freshness
  // -----------------------------------------------------------------------
  const authDate = new Date(authDateUnix * 1000);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = nowSeconds - authDateUnix;

  if (ageSeconds > maxAgeSeconds) {
    return {
      valid: false,
      error: `initData expired: auth_date is ${ageSeconds}s old, max allowed is ${maxAgeSeconds}s`,
    };
  }

  if (ageSeconds < -60) {
    // Allow 60s clock skew into the future, but reject beyond that
    return {
      valid: false,
      error: `initData auth_date is ${-ageSeconds}s in the future (beyond 60s tolerance)`,
    };
  }

  // -----------------------------------------------------------------------
  // 6. Parse user data
  // -----------------------------------------------------------------------
  const result: TelegramAuthResult = {
    valid: true,
    authDate,
    ...parseUserData(params.get("user")),
  };

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute HMAC-SHA256 using Web Crypto API.
 *
 * @param key - The HMAC key as raw bytes.
 * @param data - The message to sign.
 * @returns The HMAC digest as a Uint8Array.
 */
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    data as unknown as ArrayBuffer,
  );
  return new Uint8Array(signature);
}

/** Convert a hex string to Uint8Array. Returns null if invalid hex. */
function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Parse the `user` JSON field from initData.
 *
 * Returns an object with userId, username, firstName, lastName if present.
 * Returns an empty object if user data is absent or unparseable.
 */
function parseUserData(
  userJson: string | null,
): Pick<TelegramAuthResult, "userId" | "username" | "firstName" | "lastName"> {
  if (!userJson) return {};

  try {
    const user = JSON.parse(userJson) as Record<string, unknown>;
    return {
      userId: typeof user.id === "number" ? user.id : undefined,
      username: typeof user.username === "string" ? user.username : undefined,
      firstName: typeof user.first_name === "string" ? user.first_name : undefined,
      lastName: typeof user.last_name === "string" ? user.last_name : undefined,
    };
  } catch {
    // User JSON is optional data enrichment; a parsing failure here
    // does not invalidate the HMAC signature itself.
    return {};
  }
}
