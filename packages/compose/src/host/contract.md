# host contract

## Inputs

- `CompositeUiDescriptor` from core types (for rendering)
- HTML string (for serving)

## Outputs

- HTML5 document string from `renderComposite()`
- `ServeDashboardHandle` from `serveDashboard()` (URL + shutdown)
- `CompositeUiHost` interface for custom host implementations
- `HostConfig` for host configuration

## Invariants

- Renderer is a pure function: same descriptor → same HTML.
- `serveDashboard()` is the only I/O in this layer.
- Depends on core types + sdk (for COMPOSE_EVENT_METHOD constant).
- No dependency on runtime or deploy layers.
- Generated HTML escapes all user-controlled content (XSS protection).
- Event bus handles malformed messages gracefully.
