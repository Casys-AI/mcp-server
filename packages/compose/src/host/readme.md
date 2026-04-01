# host

Host integration layer — rendering dashboards and serving them to users.

## API

- `renderComposite(descriptor)` — generate a self-contained HTML5 document from a composite descriptor
- `serveDashboard(html, options)` — serve composed HTML on localhost with auto-open browser
- `CompositeUiHost` — interface for custom host implementations (mount/unmount)
- `HostConfig` — configuration options (sandbox, allowed origins, limits)

## Submodules

- `renderer/` — HTML/CSS/JS generation with event bus (supports preset + areas layouts)
- `serve.ts` — local dashboard server (`Deno.serve` wrapper)

## Design decisions

- **Renderer in host/, not core/**: The renderer generates HTML/CSS/JS — that's
  presentation, not composition semantics. MCP servers that import `core/` for
  types should not pull in HTML generation code. Moving the renderer here keeps
  `core/` pure and import-light.

- **Areas layout for agents**: Simple presets (split/grid/tabs/stack) are limiting.
  The areas grid (`areas: [["sidebar", "main"]]` + proportional columns/rows) lets
  an agent describe spatial layouts without CSS knowledge. Semantic gap tokens
  (compact/normal/spacious) replace pixel values.

- **No iframe sandbox**: MCP UIs run on different ports than the dashboard host.
  `sandbox="allow-same-origin"` breaks cross-origin postMessage between them.
  Since UIs come from trusted MCPs (our own catalog), sandboxing is unnecessary.
