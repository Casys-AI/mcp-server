# renderer contract

## Role

Generate self-contained dashboard HTML and a parent-side MCP Apps event bus from a composite
descriptor.

## Inputs

- `CompositeUiDescriptor`: layout, children, resolved sync rules, and shared context.
- Optional `RenderCompositeOptions`: explicit slot URLs, expected origins, local proxy routes,
  implemented capability flags, initial results, and sandbox policy.

## Outputs

- Complete HTML5 document with inline CSS, iframes, and event bus script.
- Resolved serializable slot settings for tests and host integration.

## Invariants

- Without options, static output remains compatible with the legacy renderer: no sandbox attribute,
  no local proxy route, no `serverTools` or `serverResources` capability.
- A configured interactive slot uses only its supplied local endpoint and expected origin. The
  renderer does not derive server URLs from `ui://`.
- A complete initial tool result is sent once and only after the App confirms initialization.
- The event bus ignores malformed messages and rejects an incoming message whose `WindowProxy` or
  configured origin does not match the slot.
- User-controlled values and inline script data are safely encoded.

## Dependency constraints

- Imports only core descriptor/types and local CSS/JS helpers.
- Has no dependency on collector, runtime transport, deployment, or an MCP client.
