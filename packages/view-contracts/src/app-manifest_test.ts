import { assertEquals, assertThrows } from "@std/assert";

import {
  defineViewAppManifest,
  parseViewAppManifestJson,
  VIEW_APP_MANIFEST_SCHEMA,
  VIEWER_SESSION_APPLY_ACTION,
} from "../mod.ts";

const WHOLE_VIEW_MANIFEST = {
  schemaVersion: VIEW_APP_MANIFEST_SCHEMA,
  app: {
    id: "io.casys.mcp-build123d.results",
    title: "Build123d results",
    version: "1.2.3",
  },
  resources: [{
    uri: "ui://mcp-build123d/results-viewer",
    ownership: "whole-view",
    resultSchemas: ["io.casys.build123d.execution/1.0"],
    acceptedActions: [VIEWER_SESSION_APPLY_ACTION],
    sessionSchemas: ["io.casys.thread.cad-viewer-session/1.0"],
  }],
} as const;

const COMPONENT_CATALOG = {
  components: {
    "build123d.summary": {
      title: "Geometry summary",
      events: { emits: ["semantic.selection.changed"] },
    },
  },
  defaultSurface: {
    layout: { type: "grid", columns: 1, gap: "sm" },
    components: [{ id: "summary", component: "build123d.summary" }],
  },
} as const;

Deno.test("whole-view resources validate without a component catalog", () => {
  const manifest = defineViewAppManifest(WHOLE_VIEW_MANIFEST);
  assertEquals(manifest, WHOLE_VIEW_MANIFEST);
  assertEquals(parseViewAppManifestJson(JSON.stringify(WHOLE_VIEW_MANIFEST)), manifest);
  assertEquals(Object.isFrozen(manifest), true);
  assertEquals(Object.isFrozen(manifest.resources), true);
  assertEquals(Object.isFrozen(manifest.resources[0]!.acceptedActions), true);
  assertEquals(manifest.resources[0]!.components, undefined);
});

Deno.test("component-catalog ownership requires a catalog but whole-view may expose one", () => {
  const withCatalog = cloneManifest() as unknown as {
    resources: Array<Record<string, unknown>>;
  };
  withCatalog.resources[0]!.components = COMPONENT_CATALOG;
  assertEquals(
    defineViewAppManifest(withCatalog).resources[0]!.components?.components["build123d.summary"]
      ?.title,
    "Geometry summary",
  );

  const missingCatalog = cloneManifest() as unknown as {
    resources: Array<Record<string, unknown>>;
  };
  missingCatalog.resources[0]!.ownership = "component-catalog";
  assertThrows(
    () => defineViewAppManifest(missingCatalog),
    TypeError,
    "component-catalog ownership must declare components",
  );
});

Deno.test("manifest rejects sparse and adorned arrays at every manifest boundary", () => {
  for (const mutation of [makeSparse, makeAdorned] as const) {
    const resourcesManifest = cloneManifest() as {
      resources: unknown[];
    };
    mutation(resourcesManifest.resources);
    assertThrows(
      () => defineViewAppManifest(resourcesManifest),
      TypeError,
      "resources must be a dense, unadorned array",
    );

    for (const field of ["resultSchemas", "acceptedActions", "sessionSchemas"] as const) {
      const fieldManifest = cloneManifest() as {
        resources: Array<Record<typeof field, unknown[]>>;
      };
      mutation(fieldManifest.resources[0]![field]);
      assertThrows(
        () => defineViewAppManifest(fieldManifest),
        TypeError,
        `${field} must be a dense, unadorned array`,
      );
    }

    const surfaceManifest = manifestWithCatalog();
    const surface = (surfaceManifest.resources[0]!.components as {
      defaultSurface: { components: unknown[] };
    }).defaultSurface;
    mutation(surface.components);
    assertThrows(
      () => defineViewAppManifest(surfaceManifest),
      TypeError,
      "defaultSurface.components must be a dense, unadorned array",
    );

    const propsManifest = manifestWithCatalog();
    const propsSurface = (propsManifest.resources[0]!.components as {
      defaultSurface: { components: Array<Record<string, unknown>> };
    }).defaultSurface;
    const values: unknown[] = ["one", "two"];
    propsSurface.components[0]!.props = { values };
    mutation(values);
    assertThrows(
      () => defineViewAppManifest(propsManifest),
      TypeError,
      "props must be JSON",
    );
  }
});

Deno.test("result and session schema identities require exact numeric versions", () => {
  for (
    const identity of [
      "io.casys.example/latest",
      "io.casys.example/latest/1.0",
      "io.casys.example/stable",
      "io.casys.example/v1",
      "io.casys.example/v1/1.0",
      "io.casys.example/^1.0",
      "io.casys.example/>=1.0",
      "io.casys.example/1.x",
      "io.casys.example/1.0 - 2.0",
      "io.casys.example",
    ]
  ) {
    for (const field of ["resultSchemas", "sessionSchemas"] as const) {
      const manifest = cloneManifest() as {
        resources: Array<Record<typeof field, string[]>>;
      };
      manifest.resources[0]![field] = [identity];
      assertThrows(
        () => defineViewAppManifest(manifest),
        TypeError,
        "exact versioned schema identity",
      );
    }
  }

  const exactPatch = cloneManifest() as {
    resources: Array<{ resultSchemas: string[] }>;
  };
  exactPatch.resources[0]!.resultSchemas = ["https://schemas.casys.io/example/1.2.3"];
  assertEquals(
    defineViewAppManifest(exactPatch).resources[0]!.resultSchemas,
    ["https://schemas.casys.io/example/1.2.3"],
  );
});

Deno.test("session compatibility is declared by paired resource actions and schemas", () => {
  const missingAction = cloneManifest() as unknown as {
    resources: Array<Record<string, unknown>>;
  };
  delete missingAction.resources[0]!.acceptedActions;
  assertThrows(
    () => defineViewAppManifest(missingAction),
    TypeError,
    "both viewer.session.apply in acceptedActions and sessionSchemas",
  );

  const missingSchemas = cloneManifest() as unknown as {
    resources: Array<Record<string, unknown>>;
  };
  delete missingSchemas.resources[0]!.sessionSchemas;
  assertThrows(
    () => defineViewAppManifest(missingSchemas),
    TypeError,
    "both viewer.session.apply in acceptedActions and sessionSchemas",
  );
});

Deno.test("manifest rejects authority, invocation, duplicate, and mutable resource aliases", () => {
  const withEndpoint = cloneManifest() as unknown as Record<string, unknown>;
  withEndpoint.endpoint = "http://provider.internal/mcp";
  assertThrows(
    () => defineViewAppManifest(withEndpoint),
    TypeError,
    "contain only schemaVersion, app, and resources",
  );

  const withToolArgs = cloneManifest() as unknown as {
    resources: Array<Record<string, unknown>>;
  };
  withToolArgs.resources[0]!.toolArgs = { project: "latest" };
  assertThrows(
    () => defineViewAppManifest(withToolArgs),
    TypeError,
    "contains unsupported fields",
  );

  const duplicateAction = cloneManifest() as unknown as {
    resources: Array<{ acceptedActions: string[] }>;
  };
  duplicateAction.resources[0]!.acceptedActions.push(VIEWER_SESSION_APPLY_ACTION);
  assertThrows(
    () => defineViewAppManifest(duplicateAction),
    TypeError,
    "must not contain duplicates",
  );

  const mutableAlias = cloneManifest() as unknown as {
    resources: Array<{ uri: string }>;
  };
  mutableAlias.resources[0]!.uri = "ui://mcp-build123d/latest";
  assertThrows(
    () => defineViewAppManifest(mutableAlias),
    TypeError,
    "exact ui:// URI",
  );
});

function cloneManifest(): unknown {
  return JSON.parse(JSON.stringify(WHOLE_VIEW_MANIFEST));
}

function manifestWithCatalog(): {
  resources: Array<Record<string, unknown>>;
} {
  const manifest = cloneManifest() as {
    resources: Array<Record<string, unknown>>;
  };
  manifest.resources[0]!.components = JSON.parse(JSON.stringify(COMPONENT_CATALOG));
  return manifest;
}

function makeSparse(value: unknown[]): void {
  delete value[0];
}

function makeAdorned(value: unknown[]): void {
  Object.defineProperty(value, "metadata", {
    value: "not-json-array-data",
    enumerable: false,
  });
}
