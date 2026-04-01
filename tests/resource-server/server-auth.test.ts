import { assertEquals } from "@std/assert";
import { startResourceServer } from "../../src/resource-server/server.ts";
import type { ResourceServerConfig } from "../../src/resource-server/server.ts";
import type { McpAppsMessage, McpAppsRequest } from "../../src/core/types.ts";
import type { BridgeSession } from "../../src/resource-server/session.ts";

// ---------------------------------------------------------------------------
// Test helpers — reuse HMAC builder from telegram-auth tests
// ---------------------------------------------------------------------------

const TEST_BOT_TOKEN = "7890123456:AAHabcdefghijklmnopqrstuvwxyz12345";

const TEST_USER = {
  id: 123456789,
  first_name: "John",
  last_name: "Doe",
  username: "johndoe",
  language_code: "en",
};

async function buildInitData(
  overrides: {
    botToken?: string;
    authDate?: number;
    user?: Record<string, unknown>;
  } = {},
): Promise<string> {
  const botToken = overrides.botToken ?? TEST_BOT_TOKEN;
  const authDate = overrides.authDate ?? Math.floor(Date.now() / 1000);
  const user = overrides.user ?? TEST_USER;

  const params = new URLSearchParams();
  params.set("auth_date", String(authDate));
  params.set("query_id", "AAGHabc123");
  params.set("user", JSON.stringify(user));

  // Build data_check_string
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

function makeServerConfig(
  overrides: Partial<ResourceServerConfig> = {},
): ResourceServerConfig {
  return {
    assetDirectories: {},
    platform: "telegram",
    telegramBotToken: TEST_BOT_TOKEN,
    ...overrides,
  };
}

async function createSessionId(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/session`, { method: "POST" });
  const data = await res.json();
  return data.sessionId;
}

function connectWs(baseUrl: string, sessionId: string): WebSocket {
  const wsUrl = baseUrl.replace(/^http/, "ws") + `/bridge?session=${sessionId}`;
  return new WebSocket(wsUrl);
}

function waitForMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS message timeout")), 5000);
    ws.addEventListener("message", (event) => {
      clearTimeout(timer);
      resolve(JSON.parse(event.data));
    }, { once: true });
  });
}

function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS close timeout")), 5000);
    ws.addEventListener("close", (event) => {
      clearTimeout(timer);
      resolve({ code: event.code, reason: event.reason });
    }, { once: true });
  });
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    const timer = setTimeout(() => reject(new Error("WS open timeout")), 5000);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("server-auth - fail-fast: telegram without botToken throws", () => {
  let threw = false;
  try {
    startResourceServer({
      assetDirectories: {},
      platform: "telegram",
      // No telegramBotToken
    });
  } catch (err) {
    threw = true;
    assertEquals(
      (err as Error).message.includes("Telegram requires an auth handler"),
      true,
    );
  }
  assertEquals(threw, true, "Expected an error to be thrown");
});

Deno.test("server-auth - line platform without botToken is allowed", async () => {
  const server = startResourceServer({
    assetDirectories: {},
    platform: "line",
    // No telegramBotToken — fine for line
  });

  const res = await fetch(`${server.baseUrl}/health`);
  const data = await res.json();
  assertEquals(data.status, "ok");

  await server.stop();
});

Deno.test("server-auth - valid initData authenticates session", async () => {
  const server = startResourceServer(makeServerConfig());

  try {
    const sessionId = await createSessionId(server.baseUrl);
    const ws = connectWs(server.baseUrl, sessionId);
    await waitForOpen(ws);

    // Send auth
    const initData = await buildInitData();
    ws.send(JSON.stringify({ type: "auth", initData }));

    const response = await waitForMessage(ws);
    assertEquals(response.type, "auth_ok");
    assertEquals(response.userId, 123456789);

    // Verify session is authenticated
    const session = server.sessions.get(sessionId);
    assertEquals(session?.authenticated, true);
    assertEquals(session?.userId, 123456789);
    assertEquals(session?.username, "johndoe");

    ws.close();
  } finally {
    await server.stop();
  }
});

Deno.test("server-auth - invalid initData closes WebSocket with 4001", async () => {
  const server = startResourceServer(makeServerConfig());

  try {
    const sessionId = await createSessionId(server.baseUrl);
    const ws = connectWs(server.baseUrl, sessionId);
    await waitForOpen(ws);

    // Send bad auth
    ws.send(JSON.stringify({ type: "auth", initData: "fake_data=1&hash=bad" }));

    const response = await waitForMessage(ws);
    assertEquals(response.type, "auth_error");

    const closeEvent = await waitForClose(ws);
    assertEquals(closeEvent.code, 4001);
  } finally {
    await server.stop();
  }
});

Deno.test("server-auth - non-auth message on unauthenticated session closes with 4003", async () => {
  const server = startResourceServer(makeServerConfig());

  try {
    const sessionId = await createSessionId(server.baseUrl);
    const ws = connectWs(server.baseUrl, sessionId);
    await waitForOpen(ws);

    // Send a JSON-RPC message without authenticating first
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "get_time" },
    }));

    const response = await waitForMessage(ws);
    assertEquals(response.type, "auth_error");

    const closeEvent = await waitForClose(ws);
    assertEquals(closeEvent.code, 4003);
  } finally {
    await server.stop();
  }
});

Deno.test("server-auth - messages pass to onMessage after auth", async () => {
  let receivedSession: BridgeSession | null = null;
  let receivedMethod: string | null = null;

  const server = startResourceServer(makeServerConfig({
    onMessage: (session: BridgeSession, message: McpAppsMessage) => {
      receivedSession = session;
      receivedMethod = (message as McpAppsRequest).method;
      return Promise.resolve({
        jsonrpc: "2.0" as const,
        id: (message as McpAppsRequest).id,
        result: { content: [{ type: "text", text: "ok" }] },
      });
    },
  }));

  try {
    const sessionId = await createSessionId(server.baseUrl);
    const ws = connectWs(server.baseUrl, sessionId);
    await waitForOpen(ws);

    // Authenticate
    const initData = await buildInitData();
    ws.send(JSON.stringify({ type: "auth", initData }));
    const authResponse = await waitForMessage(ws);
    assertEquals(authResponse.type, "auth_ok");

    // Now send a tool call
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: 42,
      method: "tools/call",
      params: { name: "test_tool" },
    }));

    const toolResponse = await waitForMessage(ws);
    assertEquals((toolResponse as Record<string, unknown>).id, 42);

    // Verify handler received authenticated session
    const sess = receivedSession as unknown as BridgeSession;
    assertEquals(sess.authenticated, true);
    assertEquals(sess.userId, 123456789);
    assertEquals(receivedMethod, "tools/call");

    ws.close();
  } finally {
    await server.stop();
  }
});

Deno.test("server-auth - session created via HTML starts unauthenticated", async () => {
  const server = startResourceServer(makeServerConfig());

  try {
    // Sessions created by the store should start unauthenticated
    const sessionId = await createSessionId(server.baseUrl);
    const session = server.sessions.get(sessionId);
    assertEquals(session?.authenticated, false);
    assertEquals(session?.userId, undefined);
  } finally {
    await server.stop();
  }
});

Deno.test("server-auth - custom auth handler works for arbitrary platforms", async () => {
  const server = startResourceServer({
    assetDirectories: {},
    platform: "custom-platform",
    auth: (_session, message) => {
      const payload = message.payload as Record<string, unknown> | undefined;
      return Promise.resolve(
        payload?.token === "ok"
          ? {
              valid: true,
              principalId: "user-42",
              username: "custom-user",
              context: { provider: "custom-platform" },
            }
          : {
              valid: false,
              error: "bad token",
            },
      );
    },
    onMessage: (_session, message) => {
      const req = message as McpAppsRequest;
      return Promise.resolve({
        jsonrpc: "2.0" as const,
        id: req.id,
        result: { echoedMethod: req.method },
      });
    },
  });

  try {
    const sessionId = await createSessionId(server.baseUrl);
    const ws = connectWs(server.baseUrl, sessionId);
    await waitForOpen(ws);

    ws.send(JSON.stringify({
      type: "auth",
      platform: "custom-platform",
      payload: { token: "ok" },
    }));

    const authResponse = await waitForMessage(ws);
    assertEquals(authResponse.type, "auth_ok");
    assertEquals(authResponse.principalId, "user-42");

    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: { name: "generic_tool" },
    }));

    const rpcResponse = await waitForMessage(ws);
    assertEquals(rpcResponse.id, 99);

    const session = server.sessions.get(sessionId);
    assertEquals(session?.authenticated, true);
    assertEquals(session?.principalId, "user-42");
    assertEquals(session?.username, "custom-user");
    assertEquals(session?.authContext?.provider, "custom-platform");

    ws.close();
  } finally {
    await server.stop();
  }
});
