# host

Host integration layer for rendering composite dashboards.

## API

- `renderComposite(descriptor, options?)` — pure HTML5 renderer. With no options it preserves the
  historical static iframe layout.
- `serveDashboard(html, options)` — minimal loopback server for already-built static HTML.
- `CompositeUiHost` / `HostConfig` — contracts for a custom embedding host.

The live local MCP Apps host is deliberately exported from `runtime`, not from this layer:

- `composeAndServeDashboard(request, options?)`
- `serveComposedDashboard(result, options?)`

Those APIs require an active MCP cluster and resource reads, whereas `host/` must remain independent
of runtime connections.

## Submodules

- `renderer/` — HTML/CSS/JS generation with event bus, preset and areas layouts, and optional
  slot-local bridge configuration.
- `serve.ts` — static loopback HTML server.

## Design decisions

- **Renderer in `host/`, not `core/`**: HTML/CSS/JS is presentation, not composition semantics.
  `core/` users do not pull rendering code.
- **Areas layout for agents**: simple presets can be replaced with named areas plus proportional
  columns/rows and semantic gaps.
- **Static versus interactive is explicit**: a renderer option does not make a network proxy. Only
  the runtime host installs a concrete slot-local route and advertises its matching capability.
- **Sandboxed children can retain a verifiable origin**: the interactive runtime gives every child a
  distinct loopback origin, then uses a script-capable sandbox with `allow-same-origin`. This does
  not make a child same-origin with the parent or another panel; it lets the parent reject a message
  from a navigated child origin.
