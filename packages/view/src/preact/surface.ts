/** Preact bindings for result-driven MCP App component surfaces. */

import { createElement, type FunctionComponent, render } from "preact";

import { createMcpApp, defineView } from "../app.ts";
import {
  activeComponentSurface,
  advertisedComponentCatalog,
  defineViewComponent,
  mountComponentSurface,
  type MountedComponentSurface,
  type ViewComponentDescriptor,
  type ViewComponentRegistry,
} from "../components.ts";
import { readResultData, type ResultData } from "../results.ts";
import { installMcpViewTheme } from "../theme.ts";
import type { AppContext } from "../types.ts";
import type { JsonValue } from "../components.ts";

export interface PreactSurfaceAppState<TData> {
  currentData?: TData;
}

export type PreactSurfaceContext<TData> = AppContext<
  PreactSurfaceAppState<TData>
>;

export interface PreactSurfaceComponentProps<TData> {
  readonly data: TData;
  readonly context: PreactSurfaceContext<TData>;
  readonly instanceId: string;
  readonly props: Readonly<Record<string, JsonValue>>;
}

/** Small injection seam for DOM-light unit tests. */
export interface PreactComponentRenderer {
  mount<P extends object>(
    component: FunctionComponent<P>,
    props: P,
    target: HTMLElement,
  ): void;
  unmount(target: HTMLElement): void;
}

export const preactSurfaceRenderer: PreactComponentRenderer = {
  mount(component, props, target) {
    render(createElement(component, props), target);
  },
  unmount(target) {
    render(null, target);
  },
};

/** Turn one Preact component into a renderer-neutral mcp-view component. */
export function definePreactComponent<TData>(
  descriptor: ViewComponentDescriptor,
  component: FunctionComponent<PreactSurfaceComponentProps<TData>>,
  renderer: PreactComponentRenderer = preactSurfaceRenderer,
) {
  return defineViewComponent<TData, PreactSurfaceContext<TData>>({
    descriptor,
    mount(target, context) {
      renderer.mount(component, {
        data: context.data,
        context: context.appContext,
        instanceId: context.instanceId,
        props: context.props,
      }, target);
      return () => renderer.unmount(target);
    },
  });
}

export type SurfaceMessageKind = "loading" | "empty" | "error" | "surface-required";

export interface PreactSurfaceAppOptions<TData extends ResultData> {
  readonly root: HTMLElement;
  readonly info: { readonly name: string; readonly version: string };
  readonly registry: ViewComponentRegistry<
    TData,
    PreactSurfaceContext<TData>
  >;
  readonly validate?: (value: unknown) => value is TData;
  readonly loadingLabel?: string;
  readonly emptyLabel?: string;
  readonly surfaceRequiredLabel?: string;
  readonly surfaceClassName?: string;
  /** Install the shared mcp-view theme. Defaults to true. */
  readonly theme?: boolean;
  readonly renderMessage?: (message: string, kind: SurfaceMessageKind) => Node;
  readonly onError?: (error: unknown) => void;
}

/**
 * Start a result-driven MCP App backed by Preact components.
 *
 * The registry may expose a default surface or be component-only. In the
 * latter case, a host-selected surface is required and no artificial
 * standalone composition is invented.
 */
export async function startPreactSurfaceApp<TData extends ResultData>(
  options: PreactSurfaceAppOptions<TData>,
): Promise<void> {
  if (options.theme !== false) installMcpViewTheme();
  const state: PreactSurfaceAppState<TData> = {};
  let mounted: MountedComponentSurface | undefined;
  let pendingMount: Promise<void> | undefined;
  let mountGeneration = 0;
  let removeHostContextListener: (() => void) | undefined;

  const reportError = (error: unknown): void => {
    if (options.onError) options.onError(error);
    else console.error("[mcp-view/preact] Component surface failed", error);
  };

  const message = (label: string, kind: SurfaceMessageKind): Node => {
    if (options.renderMessage) return options.renderMessage(label, kind);
    const node = document.createElement("div");
    node.className = `mcp-view-message mcp-view-message-${kind}`;
    node.textContent = label;
    return node;
  };

  const disposeSurface = async (): Promise<void> => {
    mountGeneration += 1;
    await pendingMount;
    pendingMount = undefined;
    const active = mounted;
    mounted = undefined;
    await active?.dispose();
  };

  const surface = defineView<PreactSurfaceAppState<TData>, TData, TData>({
    onEnter(_context, data) {
      state.currentData = data;
      return data;
    },
    render(context, data) {
      const shell = document.createElement("div");
      shell.className = options.surfaceClassName ?? "mcp-view-preact-surface";
      const selected = activeComponentSurface(options.registry, context.hostContext);
      if (!selected) {
        shell.replaceChildren(message(
          options.surfaceRequiredLabel ??
            "This App exposes components and requires a host-selected surface.",
          "surface-required",
        ));
        return shell;
      }

      const generation = ++mountGeneration;
      pendingMount = mountComponentSurface({
        root: shell,
        registry: options.registry,
        data,
        appContext: context,
        hostContext: context.hostContext,
        surface: selected,
      }).then(async (next) => {
        if (generation !== mountGeneration) {
          await next.dispose();
          return;
        }
        mounted = next;
      }).catch((error) => {
        shell.replaceChildren(message(
          `Component surface failed: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        ));
        reportError(error);
      });
      return shell;
    },
    onLeave: disposeSurface,
  });

  const handle = await createMcpApp<PreactSurfaceAppState<TData>>({
    info: options.info,
    root: options.root,
    views: {
      loading: defineView({
        render: () => message(options.loadingLabel ?? "Waiting for data…", "loading"),
      }),
      empty: defineView({
        render: () => message(options.emptyLabel ?? "No structured data received.", "empty"),
      }),
      surface,
    },
    initialView: "loading",
    initialState: state,
    componentCatalog: advertisedComponentCatalog(options.registry),
    onToolInputPartial: async (_params, app) => {
      state.currentData = undefined;
      await app.navigate("loading");
    },
    onToolResult: async (result, app) => {
      const data = readResultData<TData>(result, {
        fallback: "json-text",
        ...(options.validate ? { validate: options.validate } : {}),
      });
      await app.navigate(data ? "surface" : "empty", data);
    },
    onTeardown: () => {
      removeHostContextListener?.();
      removeHostContextListener = undefined;
    },
  });

  const onHostContextChanged = (): void => {
    const data = state.currentData;
    if (!data || handle.currentView !== "surface") return;
    void handle.navigate("surface", data).catch(reportError);
  };
  handle.ctx.app.addEventListener("hostcontextchanged", onHostContextChanged);
  removeHostContextListener = () => {
    handle.ctx.app.removeEventListener("hostcontextchanged", onHostContextChanged);
  };
}
