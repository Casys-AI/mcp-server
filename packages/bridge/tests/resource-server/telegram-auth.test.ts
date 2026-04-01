import { assertEquals, assertRejects } from "@std/assert";
import { validateTelegramInitData } from "../../src/resource-server/telegram-auth.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TEST_BOT_TOKEN = "7890123456:AAHabcdefghijklmnopqrstuvwxyz12345";

const TEST_USER = {
  id: 123456789,
  first_name: "John",
  last_name: "Doe",
  username: "johndoe",
  language_code: "en",
};

/**
 * Build a valid initData string for testing.
 *
 * Computes the HMAC-SHA256 signature using the same algorithm
 * the production code verifies, so we get a known-good test vector.
 */
async function buildInitData(
  overrides: {
    botToken?: string;
    authDate?: number;
    user?: Record<string, unknown>;
    extraParams?: Record<string, string>;
    skipHash?: boolean;
    forceHash?: string;
  } = {},
): Promise<string> {
  const botToken = overrides.botToken ?? TEST_BOT_TOKEN;
  const authDate = overrides.authDate ?? Math.floor(Date.now() / 1000);
  const user = overrides.user ?? TEST_USER;

  // Build the parameters (excluding hash)
  const params = new URLSearchParams();
  params.set("auth_date", String(authDate));
  params.set("query_id", "AAGHabc123");
  params.set("user", JSON.stringify(user));

  if (overrides.extraParams) {
    for (const [k, v] of Object.entries(overrides.extraParams)) {
      params.set(k, v);
    }
  }

  if (overrides.skipHash) {
    return params.toString();
  }

  if (overrides.forceHash) {
    params.set("hash", overrides.forceHash);
    return params.toString();
  }

  // Build data_check_string: sorted key=value pairs joined by \n
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  // Compute HMAC
  const encoder = new TextEncoder();
  const secretKeyRaw = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secretKey = new Uint8Array(
    await crypto.subtle.sign("HMAC", secretKeyRaw, encoder.encode(botToken)),
  );

  const hashKeyRaw = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hashBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", hashKeyRaw, encoder.encode(dataCheckString)),
  );

  const hash = Array.from(hashBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  params.set("hash", hash);

  return params.toString();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("validateTelegramInitData - valid initData is accepted", async () => {
  const initData = await buildInitData();
  const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN);

  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
  assertEquals(result.userId, 123456789);
  assertEquals(result.username, "johndoe");
  assertEquals(result.firstName, "John");
  assertEquals(result.lastName, "Doe");
  assertEquals(result.authDate instanceof Date, true);
});

Deno.test("validateTelegramInitData - invalid hash is rejected", async () => {
  const initData = await buildInitData({
    forceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN);

  assertEquals(result.valid, false);
  assertEquals(result.error, "HMAC-SHA256 hash mismatch: initData signature is invalid");
});

Deno.test("validateTelegramInitData - wrong bot token is rejected", async () => {
  const initData = await buildInitData();
  const result = await validateTelegramInitData(initData, "9999999999:WRONG_TOKEN_HERE");

  assertEquals(result.valid, false);
  assertEquals(result.error, "HMAC-SHA256 hash mismatch: initData signature is invalid");
});

Deno.test("validateTelegramInitData - expired auth_date is rejected", async () => {
  const oldTimestamp = Math.floor(Date.now() / 1000) - 200_000; // ~2.3 days ago
  const initData = await buildInitData({ authDate: oldTimestamp });
  const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN);

  assertEquals(result.valid, false);
  assertEquals(typeof result.error, "string");
  assertEquals(result.error!.includes("expired"), true);
});

Deno.test("validateTelegramInitData - custom maxAge is respected", async () => {
  const recentTimestamp = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
  const initData = await buildInitData({ authDate: recentTimestamp });

  // With 60s maxAge, 120s old data should be rejected
  const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN, 60);
  assertEquals(result.valid, false);
  assertEquals(result.error!.includes("expired"), true);

  // With 300s maxAge, same data should pass
  const result2 = await validateTelegramInitData(initData, TEST_BOT_TOKEN, 300);
  assertEquals(result2.valid, true);
});

Deno.test("validateTelegramInitData - missing hash parameter", async () => {
  const initData = await buildInitData({ skipHash: true });
  const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN);

  assertEquals(result.valid, false);
  assertEquals(result.error, "Missing 'hash' parameter in initData");
});

Deno.test("validateTelegramInitData - missing auth_date parameter", async () => {
  // Manually build initData without auth_date
  const params = new URLSearchParams();
  params.set("hash", "abc123");
  params.set("user", JSON.stringify(TEST_USER));
  const result = await validateTelegramInitData(params.toString(), TEST_BOT_TOKEN);

  assertEquals(result.valid, false);
  assertEquals(result.error, "Missing 'auth_date' parameter in initData");
});

Deno.test("validateTelegramInitData - empty initData string", async () => {
  const result = await validateTelegramInitData("", TEST_BOT_TOKEN);

  assertEquals(result.valid, false);
  assertEquals(result.error, "initData is required and must be a non-empty string");
});

Deno.test("validateTelegramInitData - missing botToken throws", async () => {
  const initData = await buildInitData();

  await assertRejects(
    () => validateTelegramInitData(initData, ""),
    Error,
    "botToken is required",
  );
});

Deno.test("validateTelegramInitData - user without optional fields", async () => {
  const minimalUser = { id: 42, first_name: "Alice" };
  const initData = await buildInitData({ user: minimalUser });
  const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN);

  assertEquals(result.valid, true);
  assertEquals(result.userId, 42);
  assertEquals(result.firstName, "Alice");
  assertEquals(result.username, undefined);
  assertEquals(result.lastName, undefined);
});

Deno.test("validateTelegramInitData - initData without user field", async () => {
  // Build manually without user field
  const authDate = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();
  params.set("auth_date", String(authDate));
  params.set("query_id", "AAGHabc123");

  // Compute hash
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const encoder = new TextEncoder();
  const secretKeyRaw = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secretKey = new Uint8Array(
    await crypto.subtle.sign("HMAC", secretKeyRaw, encoder.encode(TEST_BOT_TOKEN)),
  );
  const hashKeyRaw = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hashBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", hashKeyRaw, encoder.encode(dataCheckString)),
  );
  const hash = Array.from(hashBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  params.set("hash", hash);

  const result = await validateTelegramInitData(params.toString(), TEST_BOT_TOKEN);

  assertEquals(result.valid, true);
  assertEquals(result.userId, undefined);
  assertEquals(result.username, undefined);
});

Deno.test("validateTelegramInitData - future auth_date beyond tolerance is rejected", async () => {
  const futureTimestamp = Math.floor(Date.now() / 1000) + 300; // 5 minutes in the future
  const initData = await buildInitData({ authDate: futureTimestamp });
  const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN);

  assertEquals(result.valid, false);
  assertEquals(result.error!.includes("future"), true);
});

Deno.test("validateTelegramInitData - deterministic: same input produces same result", async () => {
  const fixedTimestamp = Math.floor(Date.now() / 1000);
  const initData = await buildInitData({ authDate: fixedTimestamp });

  const result1 = await validateTelegramInitData(initData, TEST_BOT_TOKEN);
  const result2 = await validateTelegramInitData(initData, TEST_BOT_TOKEN);

  assertEquals(result1.valid, result2.valid);
  assertEquals(result1.userId, result2.userId);
  assertEquals(result1.username, result2.username);
});
