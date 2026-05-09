# ADR 0003: Nanobot as Runtime Inspiration, Not Compose Core

Date: 2026-05-01  Status: Proposed

## Context

Nanobot is a useful reference for MCP host/product experience: it connects MCP
servers, wraps them in agent configuration, runs a local web UI, and supports
rich MCP-UI rendering. That makes it relevant to the future `mcp-compose`
runtime and CLI experience.

However, Nanobot is not primarily a UI composition library. Its center of
gravity is agent hosting: model configuration, prompts, chat sessions, server
management, and end-user chat UI. The current `mcp-compose` boundary is
different: deterministic composition of existing MCP Apps into dashboards.

## Decision

Use Nanobot as a reference for the **runtime/product layer** around compose,
not as a model for the core composition package.

The core `mcp-compose` contract remains:

- collect `_meta.ui.resourceUri` values from tool results,
- build a composite descriptor from explicit orchestration,
- render a dashboard with layout and event routing,
- keep composition deterministic, testable, and free of model/agent state.

## Patterns Worth Borrowing

- **Config-first startup**: a YAML/JSON entrypoint that declares servers,
  transports, headers/env, tool filters, and a dashboard template.
- **Local preview host**: a `mcp-compose serve` style flow that starts or
  connects MCP servers, renders the dashboard, and exposes useful runtime logs.
- **Server lifecycle ergonomics**: stdio/http setup, timeouts, enabled-tool
  allowlists, required environment variables, and clear startup failures.
- **Embedded-product shape**: make generated dashboards easy to expose as one
  MCP UI resource so hosts such as Nanobot can render them.
- **Runtime guardrails**: explicit permission/transport/env checks before the
  dashboard starts, rather than hidden failures inside iframe interactions.

## Patterns To Avoid In Core

- Do not add an LLM/agent loop to `mcp-compose`.
- Do not add chat memory, scheduled tasks, or multi-agent semantics.
- Do not make compose depend on Nanobot.
- Do not move UI composition decisions into implicit model reasoning.
- Do not replace the pure collector/composer/renderer pipeline with a host
  runtime.

## Consequence

Future work can add a higher-level `mcp-compose serve` / `deploy` experience
that feels as simple as `nanobot run config.yaml`, while keeping the library
core small and deterministic.

If the runtime grows into a product surface, it should be treated as a layer on
top of compose rather than a rewrite of compose itself.
