import { assertEquals } from "@std/assert";
import { buildCspHeader } from "../../src/resource-server/csp.ts";

Deno.test("buildCspHeader - default policy uses deny-all base", () => {
  const csp = buildCspHeader();
  assertEquals(csp.includes("default-src 'none'"), true);
  assertEquals(csp.includes("script-src 'self' 'unsafe-inline'"), true);
  assertEquals(csp.includes("style-src 'self' 'unsafe-inline'"), true);
  assertEquals(csp.includes("img-src 'self' data:"), true);
  assertEquals(csp.includes("font-src 'self'"), true);
  assertEquals(csp.includes("connect-src 'self'"), true);
  assertEquals(csp.includes("frame-ancestors 'self'"), true);
  assertEquals(csp.includes("base-uri 'self'"), true);
});

Deno.test("buildCspHeader - custom script sources", () => {
  const csp = buildCspHeader({
    scriptSources: ["https://telegram.org"],
  });
  assertEquals(csp.includes("script-src 'self' 'unsafe-inline' https://telegram.org"), true);
});

Deno.test("buildCspHeader - custom frame ancestors", () => {
  const csp = buildCspHeader({
    frameAncestors: ["https://web.telegram.org"],
  });
  assertEquals(
    csp.includes("frame-ancestors 'self' https://web.telegram.org"),
    true,
  );
});

Deno.test("buildCspHeader - allowInline false removes unsafe-inline", () => {
  const csp = buildCspHeader({ allowInline: false });
  assertEquals(csp.includes("'unsafe-inline'"), false);
  assertEquals(csp.includes("script-src 'self'"), true);
  assertEquals(csp.includes("style-src 'self'"), true);
});

Deno.test("buildCspHeader - allowInline true (explicit) keeps unsafe-inline", () => {
  const csp = buildCspHeader({ allowInline: true });
  assertEquals(csp.includes("script-src 'self' 'unsafe-inline'"), true);
  assertEquals(csp.includes("style-src 'self' 'unsafe-inline'"), true);
});
