/**
 * Result-driven MCP App over one component registry, renderer-neutral.
 *
 * Every componentized viewer repeats the same lifecycle: install the theme,
 * show a status until the host sends a result, project that result into a
 * data model, mount the host-selected surface, remount it when the host
 * context changes, and make sure only the latest mount survives. Copies of
 * that loop drifted — one lost the generation guard in its error path,
 * another buffered recorded sessions by hand. This module is the loop, once.
 * Renderers plug in through `renderStatus`; `startPreactSurfaceApp` binds it
 * to the Preact `StateMessage`.
 */

import {
  type AppConfig,
  type AppContext,
  type AppHandle,
  createMcpApp,
  defineView,
  readResultData,
  type ResultData,
} from "@casys/mcp-view";
import {
  activeComponentSurface,
  applySurfaceContext,
  componentCatalogCapabilities,
  mountComponentSurface,
  type MountedComponentSurface,
  type ViewComponentRegistry,
} from "./components.ts";
import type { ComponentTone } from "./component-primitives.ts";
import { installMcpViewTheme } from "./theme.ts";

export interface SurfaceAppState<TData> {
  currentData?: TData;
}

export type SurfaceAppContext<TData> = AppContext<SurfaceAppState<TData>>;

/** The host tool result exactly as `createMcpApp` delivers it. */
export type SurfaceToolResult = Parameters<
  NonNullable<AppConfig<SurfaceAppState<unknown>>["onToolResult"]>
>[0];

type HostApp = AppContext<SurfaceAppState<unknown>>["app"];

/** The server reads an App may need while projecting a result or a session. */
export interface SurfaceHostAccess {
  readonly readServerResource: (
    uri: string,
  ) => ReturnType<HostApp["readServerResource"]>;
}

export type SurfaceStatusTone = ComponentTone;

/**
 * What the App displays. `result` mounts the component surface; every other
 * kind renders one status through `renderStatus`. `notice` carries a
 * caller-owned presentation for domain states such as "recorded evidence
 * unresolved" that are neither an error nor an absence of data. `code` is a
 * caller-owned machine identifier, forwarded verbatim to the status.
 */
export type SurfaceDisplayState<TData> =
  | { readonly kind: "loading" }
  | { readonly kind: "empty" }
  | {
    readonly kind: "error";
    readonly message: string;
    readonly title?: string;
    readonly code?: string;
  }
  | {
    readonly kind: "notice";
    readonly message: string;
    readonly title?: string;
    readonly tone?: SurfaceStatusTone;
    readonly busy?: boolean;
    readonly code?: string;
  }
  | { readonly kind: "result"; readonly result: TData };

type SurfaceStatusState<TData> = Exclude<
  SurfaceDisplayState<TData>,
  { readonly kind: "result" }
>;

export type SurfaceMessageKind =
  | "loading"
  | "empty"
  | "error"
  | "notice"
  | "surface-required";

/** One status resolved to its presentation, ready for a renderer. */
export interface SurfaceStatus {
  readonly kind: SurfaceMessageKind;
  readonly message: string;
  readonly title?: string;
  readonly tone: SurfaceStatusTone;
  readonly busy: boolean;
  /** Caller-owned identifier from a `notice` or `error` state, never invented. */
  readonly code?: string;
}

export type SurfaceProjection<TInput, TData> = (
  input: TInput,
  host: SurfaceHostAccess,
) => SurfaceDisplayState<TData> | Promise<SurfaceDisplayState<TData>>;

/** Whole-view `viewer.session.apply` handling, installed before the App connects. */
export interface SurfaceViewerSession<TData, TSession> {
  readonly validate: (value: unknown) => value is TSession;
  /** Project one validated session exactly as a tool result would be. */
  readonly toState: SurfaceProjection<TSession, TData>;
  readonly onInvalid?: (value: unknown) => void;
}

export interface SurfaceAppOptions<TData, TSession = never> {
  readonly root: HTMLElement;
  readonly info: { readonly name: string; readonly version: string };
  readonly registry: ViewComponentRegistry<TData, SurfaceAppContext<TData>>;
  /**
   * Project one host tool result into a display state. Without it the result's
   * structured content (or JSON text) is the data, checked by `validate`.
   *
   * A throw becomes an `error` status and drops the remembered result, like
   * any non-`result` state. To keep the last values visible under a failure,
   * return a `result` state that carries the failure — the scaffold does.
   */
  readonly fromToolResult?: SurfaceProjection<SurfaceToolResult, TData>;
  /** Domain guard for the default projection. Exclusive with `fromToolResult`. */
  readonly validate?: (value: unknown) => value is TData;
  readonly viewerSession?: SurfaceViewerSession<TData, TSession>;
  /** Detail of the `loading` status. Default `Waiting for data…`. */
  readonly loadingLabel?: string;
  /** Detail of the `empty` status. Default `No structured data received.`. */
  readonly emptyLabel?: string;
  /**
   * Detail of the `surface-required` status. Default
   * `This App exposes components and requires a host-selected surface.`.
   */
  readonly surfaceRequiredLabel?: string;
  /** Class of the element wrapping the mounted surface. Default `mcp-view-surface-shell`. */
  readonly surfaceClassName?: string;
  /**
   * Install the shared mcp-view stylesheet at boot. Default `true`. Only the
   * boot install is skipped: kit primitives still install it when they mount,
   * and the host theme (`createMcpApp`'s `autoTheme`) is unaffected.
   */
  readonly theme?: boolean;
  /** Forwarded to `createMcpApp`; unset keeps its default (`false`). */
  readonly strict?: boolean;
  /** Render one resolved status as the element the router mounts. */
  readonly renderStatus: (status: SurfaceStatus) => Node;
  /** Receives every failure the lifecycle absorbs. Default `console.error`. */
  readonly onError?: (error: unknown) => void;
}

export interface SurfaceAppHandle<TData> {
  /**
   * Route one display state exactly as a host tool result would be. Rejects
   * with `SURFACE_APP_CLOSED` once the host tore the App down or `dispose()`
   * ran: there is no router left to show anything.
   */
  show(state: SurfaceDisplayState<TData>): Promise<void>;
  /** Manual disposal. Host teardown needs no call. */
  dispose(): Promise<void>;
}

/**
 * Injection seam for tests that cannot open an ext-apps transport. It is not
 * a production extension point: a viewer never passes it.
 */
export interface SurfaceAppRuntime {
  readonly createApp: typeof createMcpApp;
}

export type SurfaceAppErrorCode =
  | "SURFACE_APP_PROJECTION_CONFLICT"
  | "SURFACE_APP_CLOSED";

/** Options refused at the boundary. Match on `code`, not on `message`. */
export class SurfaceAppError extends TypeError {
  readonly code: SurfaceAppErrorCode;
  readonly data: Readonly<Record<string, unknown>>;

  constructor(
    code: SurfaceAppErrorCode,
    message: string,
    data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "SurfaceAppError";
    this.code = code;
    this.data = Object.freeze({ ...data });
  }
}

const DEFAULT_RUNTIME: SurfaceAppRuntime = { createApp: createMcpApp };

/**
 * Start a result-driven MCP App backed by a component registry.
 *
 * The registry may expose a default surface or be component-only. In the
 * latter case a host-selected surface is required and no artificial
 * standalone composition is invented.
 */
export async function startSurfaceApp<TData, TSession = never>(
  options: SurfaceAppOptions<TData, TSession>,
  runtime: SurfaceAppRuntime = DEFAULT_RUNTIME,
): Promise<SurfaceAppHandle<TData>> {
  if (options.fromToolResult && options.validate) {
    throw new SurfaceAppError(
      "SURFACE_APP_PROJECTION_CONFLICT",
      "startSurfaceApp accepts either fromToolResult or validate, not both",
      { recovery: "Keep fromToolResult and validate inside it, or drop it and keep validate." },
    );
  }
  if (options.theme !== false) installMcpViewTheme();

  type State = SurfaceAppState<TData>;
  type HostContext = SurfaceAppContext<TData>["hostContext"];
  const state: State = {};
  const project = options.fromToolResult ?? defaultProjection(options.validate);
  const session = options.viewerSession;
  let mounted: MountedComponentSurface | undefined;
  let pendingMount: Promise<void> | undefined;
  let mountGeneration = 0;
  let navigation: Promise<void> = Promise.resolve();
  let renderedHostContext: HostContext | undefined;
  let closed = false;
  let removeHostContextListener: (() => void) | undefined;

  const reportError = (error: unknown): void => {
    if (options.onError) options.onError(error);
    else console.error("[mcp-view-components] Surface App failed", error);
  };

  const resolve = (display: SurfaceStatusState<TData>): SurfaceStatus => {
    switch (display.kind) {
      case "loading":
        return {
          kind: "loading",
          title: "Loading",
          message: options.loadingLabel ?? "Waiting for data…",
          tone: "info",
          busy: true,
        };
      case "empty":
        return {
          kind: "empty",
          title: "Empty",
          message: options.emptyLabel ?? "No structured data received.",
          tone: "neutral",
          busy: false,
        };
      case "error":
        return {
          kind: "error",
          title: display.title ?? "Error",
          message: display.message,
          tone: "danger",
          busy: false,
          ...(display.code === undefined ? {} : { code: display.code }),
        };
      case "notice":
        return {
          kind: "notice",
          title: display.title,
          message: display.message,
          tone: display.tone ?? "neutral",
          busy: display.busy ?? false,
          ...(display.code === undefined ? {} : { code: display.code }),
        };
    }
  };

  const failure = (title: string, message: string): SurfaceStatus => ({
    kind: "error",
    title,
    message,
    tone: "danger",
    busy: false,
  });

  /**
   * Every navigation the App issues is chained here. The router serializes
   * navigations too, but a step chained behind the last one observes the
   * router settled — never a view mid-transition, when `currentView` throws
   * and `currentData` still names a result on its way out.
   */
  const enqueue = (step: () => Promise<void>): Promise<void> => {
    const next = navigation.then(step);
    navigation = next.catch(() => {});
    return next;
  };

  const show = (
    navigate: AppHandle<State>["navigate"],
    display: SurfaceDisplayState<TData>,
  ): Promise<void> =>
    enqueue(() =>
      display.kind === "result"
        ? navigate("surface", display.result)
        : navigate("status", resolve(display))
    );

  /** A projection that throws shows its failure; it never breaks the lifecycle. */
  const settle = async (
    compute: () => SurfaceDisplayState<TData> | Promise<SurfaceDisplayState<TData>>,
    rejectedTitle: string,
  ): Promise<SurfaceDisplayState<TData>> => {
    try {
      return await compute();
    } catch (error) {
      reportError(error);
      return { kind: "error", title: rejectedTitle, message: errorMessage(error) };
    }
  };

  const hostAccess = (app: AppHandle<State>): SurfaceHostAccess => ({
    readServerResource: (uri) => app.ctx.app.readServerResource({ uri }),
  });

  const disposeSurface = async (): Promise<void> => {
    mountGeneration += 1;
    await pendingMount;
    pendingMount = undefined;
    const active = mounted;
    mounted = undefined;
    await active?.dispose();
  };

  const status = defineView<State, SurfaceStatus, SurfaceStatus>({
    onEnter(_context, next) {
      state.currentData = undefined;
      return next;
    },
    render: (_context, next) => options.renderStatus(next),
    onLeave: disposeSurface,
  });

  const surface = defineView<State, TData, TData>({
    onEnter(_context, data) {
      state.currentData = data;
      return data;
    },
    render(context, data) {
      renderedHostContext = context.hostContext;
      const shell = document.createElement("div");
      shell.className = options.surfaceClassName ?? "mcp-view-surface-shell";
      let selected: ReturnType<typeof activeComponentSurface>;
      try {
        selected = activeComponentSurface(options.registry, context.hostContext);
      } catch (error) {
        // A malformed host selection must not unmount the route: the App
        // stays on its surface view and says why nothing is composed.
        reportError(error);
        shell.replaceChildren(options.renderStatus(failure(
          "Surface invalid",
          `The host-selected component surface is invalid: ${errorMessage(error)}`,
        )));
        return shell;
      }
      if (!selected) {
        shell.replaceChildren(options.renderStatus({
          kind: "surface-required",
          title: "Surface required",
          message: options.surfaceRequiredLabel ??
            "This App exposes components and requires a host-selected surface.",
          tone: "warning",
          busy: false,
        }));
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
        reportError(error);
        // A superseded mount that fails must not overwrite the newer route.
        if (generation !== mountGeneration) return;
        shell.replaceChildren(options.renderStatus(failure(
          "Surface failed",
          `Component surface failed: ${errorMessage(error)}`,
        )));
      });
      return shell;
    },
    onLeave: disposeSurface,
  });

  const handle = await runtime.createApp<State, TSession>({
    info: options.info,
    root: options.root,
    ...(options.strict === undefined ? {} : { strict: options.strict }),
    views: { status, surface },
    initialView: "status",
    initialArgs: resolve({ kind: "loading" }),
    initialState: state,
    ...(session
      ? {
        viewerSession: {
          validate: session.validate,
          onSession: async (value, _payload, app) => {
            const next = await settle(
              () => session.toState(value, hostAccess(app)),
              "Session rejected",
            );
            await show(app.navigate, next);
          },
          onInvalid: (payload) => session.onInvalid?.(payload.data),
          onError: reportError,
        },
      }
      : {}),
    capabilities: {
      experimental: componentCatalogCapabilities(options.registry),
    },
    onToolInputPartial: async (_params, app) => {
      await show(app.navigate, { kind: "loading" });
    },
    onToolResult: async (result, app) => {
      const next = await settle(
        () => project(result, hostAccess(app)),
        "Result rejected",
      );
      await show(app.navigate, next);
    },
    onTeardown: () => {
      // The router runs the active view's onLeave, which disposes the surface.
      closed = true;
      removeHostContextListener?.();
      removeHostContextListener = undefined;
    },
  });

  const surfaceHandle: SurfaceAppHandle<TData> = {
    show: (display) =>
      closed
        ? Promise.reject(
          new SurfaceAppError("SURFACE_APP_CLOSED", "The surface App has been torn down", {
            recovery: "Start a new App with startSurfaceApp; this handle cannot show anything.",
          }),
        )
        : show(handle.navigate, display),
    dispose: () => handle.dispose(),
  };

  // A host teardown buffered during the handshake has already run: there is
  // no App left to listen to.
  if (closed) return surfaceHandle;

  /** Remount the displayed result when the host context moved since it rendered. */
  const remountIfStale = (): Promise<void> =>
    enqueue(async () => {
      const data = state.currentData;
      if (closed || data === undefined || handle.ctx.hostContext === renderedHostContext) {
        return;
      }
      await handle.navigate("surface", data);
    });

  const onHostContextChanged = (): void => {
    applySurfaceContext(handle.ctx.hostContext, document.documentElement);
    remountIfStale().catch(reportError);
  };
  handle.ctx.app.addEventListener("hostcontextchanged", onHostContextChanged);
  removeHostContextListener = () => {
    handle.ctx.app.removeEventListener("hostcontextchanged", onHostContextChanged);
  };
  // Host notifications replayed by `createMcpApp` may have rendered a result
  // and then moved the host context before this listener existed.
  onHostContextChanged();

  return surfaceHandle;
}

function defaultProjection<TData>(
  validate: ((value: unknown) => value is TData) | undefined,
): SurfaceProjection<SurfaceToolResult, TData> {
  return (result) => {
    const data = readResultData<ResultData>(result, {
      fallback: "json-text",
      ...(validate ? { validate: (value: unknown): value is ResultData => validate(value) } : {}),
    });
    return data === undefined
      ? { kind: "empty" }
      : { kind: "result", result: data as unknown as TData };
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
