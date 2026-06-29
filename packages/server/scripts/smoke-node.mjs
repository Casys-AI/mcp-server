import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const distEntry = pathToFileURL(resolve(process.argv[2] ?? "mod.ts")).href;
const {
  buildClientIdMetadataDocument,
  CallbackServer,
  FileTokenStore,
  MemoryTokenStore,
} = await import(distEntry);

const document = buildClientIdMetadataDocument({
  clientName: "Node Smoke Client",
  tokenStore: new MemoryTokenStore(),
  openBrowser: async () => {},
  callbackPort: 38987,
  clientRegistration: {
    method: "client_id_metadata",
    clientIdMetadataUrl: "https://client.example.com/oauth/client.json",
    redirectUri: "http://127.0.0.1:38987/callback",
  },
});

if (document.client_id !== "https://client.example.com/oauth/client.json") {
  throw new Error("CIMD document client_id mismatch");
}

const dir = await mkdtemp(join(tmpdir(), "casys-node-smoke-"));
try {
  const store = new FileTokenStore(dir);
  await store.set("https://mcp.example.com", {
    serverUrl: "https://mcp.example.com",
    tokens: { access_token: "token", token_type: "bearer" },
    obtainedAt: Date.now(),
  });

  const stored = await store.get("https://mcp.example.com");
  if (stored?.tokens.access_token !== "token") {
    throw new Error("FileTokenStore get returned wrong token");
  }

  await store.delete("https://mcp.example.com");
  if (await store.get("https://mcp.example.com") !== null) {
    throw new Error("FileTokenStore delete did not remove token");
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}

const callbackServer = new CallbackServer({ port: 0, timeout: 5_000 });
const { port } = await callbackServer.start();
if (!(port > 0)) {
  throw new Error("CallbackServer did not bind an ephemeral port");
}
await callbackServer.close();

const occupied = createServer();
await new Promise((resolveListen, rejectListen) => {
  occupied.once("error", rejectListen);
  occupied.listen(0, "127.0.0.1", resolveListen);
});

try {
  const occupiedAddress = occupied.address();
  if (
    typeof occupiedAddress !== "object" || occupiedAddress === null ||
    typeof occupiedAddress.port !== "number"
  ) {
    throw new Error("Could not determine occupied port");
  }

  const collidingServer = new CallbackServer({
    hostname: "127.0.0.1",
    port: occupiedAddress.port,
    timeout: 1_000,
  });
  let rejected = false;
  try {
    await collidingServer.start();
  } catch {
    rejected = true;
  } finally {
    await collidingServer.close();
  }
  if (!rejected) {
    throw new Error("CallbackServer did not reject on occupied port");
  }
} finally {
  await new Promise((resolveClose, rejectClose) => {
    occupied.close((err) => err ? rejectClose(err) : resolveClose());
  });
}

console.log("node client-auth smoke ok");
