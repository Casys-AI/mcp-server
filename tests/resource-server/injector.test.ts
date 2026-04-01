import { assertEquals } from "@std/assert";
import { injectBridgeScript } from "../../src/resource-server/injector.ts";

Deno.test("injectBridgeScript - injects before </head>", () => {
  const html = "<html><head><title>App</title></head><body></body></html>";
  const result = injectBridgeScript(html, "/bridge.js");
  assertEquals(
    result.includes('<script src="/bridge.js"></script>\n</head>'),
    true,
  );
});

Deno.test("injectBridgeScript - falls back to before </body>", () => {
  const html = "<html><body><p>Hello</p></body></html>";
  const result = injectBridgeScript(html, "/bridge.js");
  assertEquals(
    result.includes('<script src="/bridge.js"></script>\n</body>'),
    true,
  );
});

Deno.test("injectBridgeScript - appends when no head or body tags", () => {
  const html = "<div>Hello</div>";
  const result = injectBridgeScript(html, "/bridge.js");
  assertEquals(
    result.endsWith('<script src="/bridge.js"></script>'),
    true,
  );
});

Deno.test("injectBridgeScript - escapes special chars in URL", () => {
  const html = "<html><head></head><body></body></html>";
  const result = injectBridgeScript(html, '/bridge.js?v=1&x="y"');
  assertEquals(result.includes("&amp;"), true);
  assertEquals(result.includes("&quot;"), true);
});
