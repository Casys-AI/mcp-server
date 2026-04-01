# deploy contract

## Inputs

- `DashboardTemplate` (from runtime types)
- `McpManifest[]` with `DeployTransport` or `StdioTransport` (for tunnel)
- `DENO_DEPLOY_TOKEN` + organization ID for API access
- User-provided env vars for MCP credentials
- Composed HTML from runtime pipeline

## Outputs

- Shareable URL (`https://relay-xxx.deno.dev`)
- `DeploymentHandle` (URL + teardown function)
- WebSocket tunnel connection (for local-data MCPs)

## Invariants

- One relay worker per dashboard deployment (no sharing between dashboards).
- Cloud MCPs are deployed with env vars stored in Deploy (never in HTML).
- Local MCPs connect via outbound WebSocket (no inbound ports needed).
- `teardownDashboard()` deletes ALL Deploy resources created by the deployment.
- Deploy is opt-in — the library works fully without it (local mode).
- Depends on runtime (compose), core (types), and Deno Deploy API.
- No dependency on host (rendering is done before deploy receives the HTML).
- Env vars are prompted from user or read from local `.env`, never hardcoded.
