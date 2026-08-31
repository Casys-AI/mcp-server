import { assertEquals, assertThrows } from "@std/assert";
import {
  defineViewAppManifest,
  parseViewAppManifestJson,
  VIEW_APP_MANIFEST_SCHEMA,
  VIEWER_SESSION_APPLY_ACTION,
} from "./app-manifest.ts";

const MANIFEST = {
  schemaVersion: VIEW_APP_MANIFEST_SCHEMA,
  app: {
    id: "io.casys.build123d.results",
    title: "Build123d results",
    version: "1.2.3",
  },
  resources: [{
    uri: "ui://mcp-build123d/results-viewer",
    resultSchemas: ["io.casys.build123d.execution/1.0"],
    sessionSchemas: ["io.casys.thread.cad-viewer-session/1.0"],
    components: {
      components: {
        "build123d.summary": {
          title: "Geometry summary",
          events: {
            emits: ["semantic.selection.changed"],
            accepts: ["semantic.selection.apply", VIEWER_SESSION_APPLY_ACTION],
          },
        },
      },
      defaultSurface: {
        layout: { type: "grid", columns: 1, gap: "sm" },
        components: [{
          id: "summary",
          component: "build123d.summary",
          props: { compact: true },
        }],
      },
    },
  }],
} as const;

Deno.test("View App manifest validates the JSON plug-in contract", () => {
  const manifest = defineViewAppManifest(MANIFEST);
  assertEquals(manifest, MANIFEST);
  assertEquals(parseViewAppManifestJson(JSON.stringify(MANIFEST)), manifest);
  assertEquals(Object.isFrozen(manifest), true);
  assertEquals(Object.isFrozen(manifest.resources), true);
  assertEquals(Object.isFrozen(manifest.resources[0]!.components.components), true);
  assertEquals(
    manifest.resources[0]!.components.components["build123d.summary"]?.events?.accepts,
    ["semantic.selection.apply", "viewer.session.apply"],
  );
});

Deno.test("View App manifest rejects authority and invocation fields", () => {
  const withEndpoint = structuredClone(MANIFEST) as unknown as Record<string, unknown>;
  withEndpoint.endpoint = "http://provider.internal/mcp";
  assertThrows(
    () => defineViewAppManifest(withEndpoint),
    TypeError,
    "contain only schemaVersion, app, and resources",
  );

  const withToolArgs = structuredClone(MANIFEST) as unknown as {
    resources: Array<Record<string, unknown>>;
  };
  withToolArgs.resources[0]!.toolArgs = { project: "latest" };
  assertThrows(
    () => defineViewAppManifest(withToolArgs),
    TypeError,
    "contains unsupported fields",
  );

  const invalidVersion = structuredClone(MANIFEST) as unknown as {
    app: { version: string };
  };
  invalidVersion.app.version = "1.2.3-alpha..1";
  assertThrows(
    () => defineViewAppManifest(invalidVersion),
    TypeError,
    "must be exact SemVer",
  );
});

Deno.test("View App manifest keeps session schemas and accepted action inseparable", () => {
  const missingAction = structuredClone(MANIFEST) as unknown as {
    resources: Array<{
      components: {
        components: Record<string, { events: { accepts: string[] } }>;
      };
    }>;
  };
  missingAction.resources[0]!.components.components["build123d.summary"]!.events.accepts = [
    "semantic.selection.apply",
  ];
  assertThrows(
    () => defineViewAppManifest(missingAction),
    TypeError,
    "must declare both viewer.session.apply and sessionSchemas",
  );

  const missingSchemas = structuredClone(MANIFEST) as unknown as {
    resources: Array<Record<string, unknown>>;
  };
  delete missingSchemas.resources[0]!.sessionSchemas;
  assertThrows(
    () => defineViewAppManifest(missingSchemas),
    TypeError,
    "must declare both viewer.session.apply and sessionSchemas",
  );
});

Deno.test("View App manifest rejects ambiguous ports and unknown surface components", () => {
  const duplicatePort = structuredClone(MANIFEST) as unknown as {
    resources: Array<{
      components: {
        components: Record<string, { events: { accepts: string[] } }>;
      };
    }>;
  };
  duplicatePort.resources[0]!.components.components["build123d.summary"]!.events.accepts = [
    VIEWER_SESSION_APPLY_ACTION,
    VIEWER_SESSION_APPLY_ACTION,
  ];
  assertThrows(
    () => defineViewAppManifest(duplicatePort),
    TypeError,
    "must not contain duplicates",
  );

  const unknownComponent = structuredClone(MANIFEST) as unknown as {
    resources: Array<{
      components: { defaultSurface: { components: Array<{ component: string }> } };
    }>;
  };
  unknownComponent.resources[0]!.components.defaultSurface.components[0]!.component =
    "build123d.unknown";
  assertThrows(
    () => defineViewAppManifest(unknownComponent),
    TypeError,
    "Unknown View App surface component",
  );
});
