# renderer

Render composite descriptors into self-contained HTML for an MCP Apps parent.

## API

- `renderComposite(descriptor, options?)` — generate a complete HTML5 document. Omitting `options`
  preserves the static renderer behaviour.
- `resolveRendererSlots(descriptor, options?)` — resolve the serializable per-slot contract used by
  the event bus.

## Pipeline position

Final pure presentation stage: a composite descriptor in, HTML string out. It does not read MCP
resources or start a server.

## Interactive slot options

An interactive runtime may supply, per numeric slot:

- a local iframe source and exact expected origin;
- a local JSON-RPC endpoint;
- `serverTools` and/or `serverResources` capability flags;
- the complete initial `CallToolResult`;
- a sandbox override.

The default interactive sandbox permits scripts and retains the child origin. The runtime is
responsible for assigning a unique child loopback origin, so that this does not grant same-origin
access to the parent or siblings.

## Event-bus behaviour

The generated browser code implements JSON-RPC 2.0 over `postMessage` and:

- replies to `ui/initialize` with only implemented host capabilities;
- waits for `ui/notifications/initialized` before delivering the complete initial result as
  `ui/notifications/tool-result`;
- relays `tools/call`, `tools/list`, `resources/read`, and `resources/list` only when that slot was
  explicitly given the matching capability and route;
- routes declared `ui/compose/event` traffic between panels, including `to:
  "*"` broadcasts;
- verifies both the source iframe window and configured origin when a runtime supplies an expected
  origin.

It never itself chooses an MCP server, tool, or resource. User-controlled content is HTML-escaped
and inline configuration is safely serialized.
