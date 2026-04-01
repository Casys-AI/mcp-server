# renderer

Render composite descriptors into self-contained MCP Apps host HTML.

## API

- `renderComposite(descriptor)` — generate a complete HTML5 document string

## Pipeline position

Final stage: composite descriptor in, HTML string out.

## Submodules

- `css/base.ts` — base CSS (reset, theming variables)
- `css/layouts.ts` — layout-specific CSS (split, grid, stack, tabs)
- `js/event-bus.ts` — client-side event bus script (JSON-RPC 2.0 over postMessage)

## Design

Output is a self-contained HTML5 document with inline CSS and JS. The event bus
implements `ui/initialize`, `ui/update-model-context`, `ui/notifications/tool-result`,
and broadcast support (`to: "*"`). User-controlled content is HTML-escaped.
