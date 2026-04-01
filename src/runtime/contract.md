# runtime contract

## Inputs

- `McpManifest` JSON files (server metadata with transport config and tool declarations)
- `DashboardTemplate` YAML files (sources, orchestration, `{{placeholder}}` args)
- `ComposeRequest` (template + manifests + runtime args)

## Outputs

- `ComposeResult` (composite descriptor + rendered HTML + warnings)
- `McpCluster` (connection manager with callTool/startAll/stopAll)
- `McpConnection` (single server connection with callTool/close/uiBaseUrl)

## Invariants

- Runtime is the only layer with I/O (process management, fetch, file reads).
- All composition logic is delegated to core (collector → composer → renderer).
- Server processes started by the cluster are always killed in `stopAll()`.
- Tool call failures are non-fatal: collected as warnings, not thrown.
- `ui://` URIs are resolved to HTTP URLs before passing to the renderer.
- HTTP transport uses `fetch()` exclusively — no custom protocol implementation.
- Manifests and templates are validated before any process is started.
- Depends on core + host (renderer). No circular deps to sdk.
