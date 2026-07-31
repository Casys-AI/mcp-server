# host contract

## Inputs

- `CompositeUiDescriptor` for pure rendering.
- Optional renderer slot configuration supplied by an interactive serving runtime.
- An already-rendered HTML string for `serveDashboard()`.

## Outputs

- A deterministic HTML5 document from `renderComposite()`.
- `ServeDashboardHandle` from the static loopback server.
- `CompositeUiHost` and `HostConfig` contracts for custom hosts.

## Invariants

- With no renderer options, output preserves the static renderer contract: it does not invent local
  resource/proxy routes or extra App capabilities.
- With a slot option, the renderer serializes only the explicit iframe URL, expected origin,
  capability flags, proxy endpoint, and initial result.
- The renderer stays pure and has no dependency on runtime, deployment, or an MCP client.
  `serveDashboard()` is the only I/O in this layer.
- Generated HTML escapes user-controlled values; inline configuration is serialized safely and the
  event bus ignores malformed messages.
- A capability is advertised only if its slot has a matching runtime endpoint. The renderer never
  decides a tool or resource allowlist.
