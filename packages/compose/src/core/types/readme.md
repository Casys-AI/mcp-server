# types

Shared type definitions for the mcp-compose composition pipeline.

## Contents

- `layout.ts` — `UiLayout` union type and validation (`split`, `grid`, `stack`, `tabs`)
- `sync-rules.ts` — `UiSyncRule` (input) and `ResolvedSyncRule` (output with slot indices)
- `orchestration.ts` — `UiOrchestration` combining layout, sync, and sharedContext
- `resources.ts` — `CollectedUiResource` (slot-indexed resource from collector)
- `descriptor.ts` — `CompositeUiDescriptor` (final output consumed by renderer)
- `mcp-apps.ts` — SEP-1865 MCP Apps spec types (`McpToolResult`, `McpUiToolMeta`, etc.)
- `errors.ts` — `ErrorCode` enum and `ValidationIssue`/`ValidationResult` shapes

## Design

Types are transport-agnostic and reusable across all core slices. No business logic
lives here — only shapes and stable identifiers.
