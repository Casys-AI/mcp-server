import { assertEquals, assertRejects } from "@std/assert";
import { CallbackServer } from "./callback-server.ts";

Deno.test("CallbackServer - receives auth code from redirect", async () => {
  const server = new CallbackServer();
  const { port, codePromise } = await server.start();

  const resp = await fetch(
    `http://localhost:${port}/callback?code=test-auth-code&state=abc`,
  );
  assertEquals(resp.status, 200);
  const body = await resp.text();
  assertEquals(body.includes("Authentication successful"), true);

  const code = await codePromise;
  assertEquals(code, "test-auth-code");

  await server.close();
});

Deno.test("CallbackServer - timeout rejects promise", async () => {
  const server = new CallbackServer({ timeout: 200 });
  const { codePromise } = await server.start();

  await assertRejects(
    () => codePromise,
    Error,
    "timeout",
  );

  await server.close();
});

Deno.test("CallbackServer - returns error page on missing code", async () => {
  const server = new CallbackServer();
  const { port } = await server.start();

  const resp = await fetch(`http://localhost:${port}/callback`);
  assertEquals(resp.status, 400);
  await resp.text();

  await server.close();
});

Deno.test("CallbackServer - port 0 auto-assigns", async () => {
  const server = new CallbackServer({ port: 0 });
  const { port } = await server.start();
  assertEquals(port > 0, true);
  await server.close();
});

Deno.test("CallbackServer - 404 on non-callback path", async () => {
  const server = new CallbackServer();
  const { port } = await server.start();

  const resp = await fetch(`http://localhost:${port}/other`);
  assertEquals(resp.status, 404);
  await resp.text();

  await server.close();
});
