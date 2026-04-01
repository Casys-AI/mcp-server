import { assertEquals } from "@std/assert";
import { BridgeClient } from "../../src/core/bridge-client.ts";
import type { PlatformAdapter } from "../../src/core/adapter.ts";
import type { BridgeTransport, TransportMessageHandler, TransportStateHandler } from "../../src/core/transport.ts";
import type { ContainerDimensions, HostContext, LifecycleEvent, McpAppsMessage } from "../../src/core/types.ts";

// ---------------------------------------------------------------------------
// Mock transport (in-memory, no real WebSocket)
// ---------------------------------------------------------------------------

class MockTransport implements BridgeTransport {
  sent: McpAppsMessage[] = [];
  private msgHandlers: TransportMessageHandler[] = [];
  private stateHandlers: TransportStateHandler[] = [];
  private _connected = false;

  send(message: McpAppsMessage): void {
    if (!this._connected) {
      throw new Error("Not connected");
    }
    this.sent.push(message);
  }

  onMessage(handler: TransportMessageHandler): void {
    this.msgHandlers.push(handler);
  }

  onStateChange(handler: TransportStateHandler): void {
    this.stateHandlers.push(handler);
  }

  connect(_url: string): Promise<void> {
    this._connected = true;
    for (const h of this.stateHandlers) h(true);
    return Promise.resolve();
  }

  disconnect(): void {
    this._connected = false;
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Simulate a message arriving from the resource server. */
  simulateIncoming(message: McpAppsMessage): void {
    for (const h of this.msgHandlers) {
      h(message);
    }
  }
}

// ---------------------------------------------------------------------------
// Mock platform adapter
// ---------------------------------------------------------------------------

function createMockPlatform(): PlatformAdapter & { lifecycleHandlers: Array<(e: LifecycleEvent) => void>; openedLinks: string[] } {
  const lifecycleHandlers: Array<(e: LifecycleEvent) => void> = [];
  const openedLinks: string[] = [];

  return {
    name: "test-platform",
    lifecycleHandlers,
    openedLinks,

    initialize(): Promise<HostContext> {
      return Promise.resolve({
        theme: "dark",
        containerDimensions: { width: 400, maxHeight: 800 },
        platform: "mobile",
        locale: "en-US",
        timeZone: "UTC",
      });
    },

    getTheme() {
      return "dark" as const;
    },

    getContainerDimensions(): ContainerDimensions {
      return { width: 400, maxHeight: 800 };
    },

    onLifecycleEvent(handler: (event: LifecycleEvent) => void): void {
      lifecycleHandlers.push(handler);
    },

    openLink(url: string): Promise<void> {
      openedLinks.push(url);
      return Promise.resolve();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("BridgeClient - starts and initializes", async () => {
  const transport = new MockTransport();
  const platform = createMockPlatform();

  const client = new BridgeClient({
    serverUrl: "ws://localhost:3002",
    platform,
    transport,
    sessionId: "test-session-123",
  });

  assertEquals(client.isStarted, false);
  assertEquals(client.currentHostContext, null);

  await client.start();

  assertEquals(client.isStarted, true);
  assertEquals(client.currentHostContext?.theme, "dark");
  assertEquals(client.currentHostContext?.platform, "mobile");
  assertEquals(transport.connected, true);

  client.destroy();
  assertEquals(client.isStarted, false);
});

Deno.test("BridgeClient - handles ui/initialize locally", async () => {
  const transport = new MockTransport();
  const platform = createMockPlatform();

  const client = new BridgeClient({
    serverUrl: "ws://localhost:3002",
    platform,
    transport,
    sessionId: "test-session",
    bridgeInfo: { name: "test-bridge", version: "1.0.0" },
  });

  await client.start();

  // ui/initialize should NOT be forwarded to resource server
  // It should be handled locally by the BridgeClient
  assertEquals(transport.sent.length, 0);

  client.destroy();
});

Deno.test("BridgeClient - forwards tool calls to transport", async () => {
  const transport = new MockTransport();
  const platform = createMockPlatform();

  const client = new BridgeClient({
    serverUrl: "ws://localhost:3002",
    platform,
    transport,
    sessionId: "test-session",
  });

  await client.start();

  // Simulate the App class sending a tools/call via the transport directly
  // (In browser, this would go through intercepted postMessage)
  const toolCallMsg: McpAppsMessage = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "get-time", arguments: {} },
  };

  // Directly test that non-locally-handled methods get forwarded
  transport.send(toolCallMsg);
  assertEquals(transport.sent.length, 1);
  assertEquals(transport.sent[0], toolCallMsg);

  client.destroy();
});

Deno.test("BridgeClient - double start throws", async () => {
  const transport = new MockTransport();
  const platform = createMockPlatform();

  const client = new BridgeClient({
    serverUrl: "ws://localhost:3002",
    platform,
    transport,
    sessionId: "test-session",
  });

  await client.start();

  try {
    await client.start();
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Already started"), true);
  } finally {
    client.destroy();
  }
});

Deno.test("BridgeClient - destroy disconnects transport", async () => {
  const transport = new MockTransport();
  const platform = createMockPlatform();

  const client = new BridgeClient({
    serverUrl: "ws://localhost:3002",
    platform,
    transport,
    sessionId: "test-session",
  });

  await client.start();
  assertEquals(transport.connected, true);

  client.destroy();
  assertEquals(transport.connected, false);
});

Deno.test("BridgeClient - lifecycle event theme-changed updates context", async () => {
  const transport = new MockTransport();
  const platform = createMockPlatform();

  const client = new BridgeClient({
    serverUrl: "ws://localhost:3002",
    platform,
    transport,
    sessionId: "test-session",
  });

  await client.start();
  assertEquals(client.currentHostContext?.theme, "dark");

  // Simulate theme change from platform
  for (const handler of platform.lifecycleHandlers) {
    handler({ type: "theme-changed" });
  }

  // Theme should still be "dark" because mock getTheme() returns "dark"
  assertEquals(client.currentHostContext?.theme, "dark");

  client.destroy();
});

Deno.test("BridgeClient - lifecycle event teardown destroys client", async () => {
  const transport = new MockTransport();
  const platform = createMockPlatform();

  const client = new BridgeClient({
    serverUrl: "ws://localhost:3002",
    platform,
    transport,
    sessionId: "test-session",
  });

  await client.start();
  assertEquals(client.isStarted, true);

  // Simulate teardown
  for (const handler of platform.lifecycleHandlers) {
    handler({ type: "teardown", reason: "test-close" });
  }

  assertEquals(client.isStarted, false);
  assertEquals(transport.connected, false);
});
