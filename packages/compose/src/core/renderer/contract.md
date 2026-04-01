# renderer contract

## Role

Generate self-contained HTML from a composite UI descriptor.

## Inputs

- `CompositeUiDescriptor` — layout, children (with resourceUri), resolved sync rules, sharedContext

## Outputs

- HTML5 string — complete document with inline CSS, iframes, and event bus script

## Invariants

- Output is deterministic for a given descriptor (except workflow UUIDs).
- Renderer escapes user-controlled content (tool names, resourceUri) before embedding.
- Event bus handles malformed postMessage gracefully (console.warn, no crash).

## Dependency constraints

- Imports from `../types/` (descriptor, resources, layout) and local submodules (css/, js/).
- No dependency on collector, sync, composer, sdk, or host.
