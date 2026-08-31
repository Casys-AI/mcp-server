# @casys/mcp-view-components

Optional component surfaces and an ERPNext-inspired visual language for MCP Apps. Domain viewers own
their rendering and semantics; this package supplies reusable roles such as cards, badges, metrics,
key-value rows, tables, toolbars, empty states, and explicit loading/error states. It does not
contain CAD, Modelica, FEA, SysML, or other domain renderers.

The package root is renderer-neutral. Preact is an optional peer and is loaded only through the
Preact subpaths:

```ts
import { defineComponentRegistry, installMcpViewTheme } from "@casys/mcp-view-components";
import {
  Card,
  definePreactComponent,
  startPreactSurfaceApp,
} from "@casys/mcp-view-components/preact";
```

Whole-view recorded sessions are declared in `@casys/mcp-view-contracts` and consumed through the
core resource lifecycle. `startPreactSurfaceApp()` accepts paired `validateSession` and
`mapSessionToData` callbacks, installs them before the App connects, and keeps mapped data in App
state. No individual component claims `viewer.session.apply`, so a remount cannot lose a one-shot
session.

## Result-viewer scaffold (Deno/JSR only)

The project generator intentionally uses Deno filesystem APIs and `deno fmt`. Run it from JSR:

```sh
deno run -A jsr:@casys/mcp-view-components@0.1.0/scaffold result-viewer ./result-viewer
```

The npm package contains only the runtime and presentation entry points. It does not export or ship
`@casys/mcp-view-components/scaffold`; Node ESM imports and CommonJS requires of that subpath are
expected to fail with `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a Deno-only module.
