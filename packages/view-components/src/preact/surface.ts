/** Preact bindings for result-driven MCP App component surfaces. */

import { createElement, type FunctionComponent, render } from "preact";

import {
  defineViewComponent,
  type JsonValue,
  type ViewComponentDefinition,
  type ViewComponentDescriptor,
} from "../components.ts";
import {
  startSurfaceApp,
  type SurfaceAppContext,
  SurfaceAppError,
  type SurfaceAppHandle,
  type SurfaceAppOptions,
  type SurfaceAppRuntime,
  type SurfaceAppState,
  type SurfaceStatus,
  type SurfaceViewerSession,
} from "../surface-app.ts";
import { renderStatusMessage } from "./components.tsx";

export type {
  SurfaceAppErrorCode,
  SurfaceAppHandle,
  SurfaceAppRuntime,
  SurfaceDisplayState,
  SurfaceHostAccess,
  SurfaceMessageKind,
  SurfaceProjection,
  SurfaceStatus,
  SurfaceStatusTone,
  SurfaceToolResult,
  SurfaceViewerSession,
} from "../surface-app.ts";
export { SurfaceAppError } from "../surface-app.ts";

export type PreactSurfaceAppState<TData> = SurfaceAppState<TData>;

export type PreactSurfaceContext<TData> = SurfaceAppContext<TData>;

export interface PreactSurfaceComponentProps<
  TData,
  TAppContext = PreactSurfaceContext<TData>,
> {
  readonly data: TData;
  readonly context: TAppContext;
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
export function definePreactComponent<
  TData,
  TAppContext = PreactSurfaceContext<TData>,
>(
  descriptor: ViewComponentDescriptor,
  component: FunctionComponent<
    PreactSurfaceComponentProps<TData, TAppContext>
  >,
  renderer: PreactComponentRenderer = preactSurfaceRenderer,
): ViewComponentDefinition<TData, TAppContext> {
  return defineViewComponent<TData, TAppContext>({
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

export interface PreactSurfaceAppOptions<TData, TSession = never>
  extends Omit<SurfaceAppOptions<TData, TSession>, "renderStatus" | "surfaceClassName"> {
  /** Class of the element wrapping the mounted surface. Default `mcp-view-preact-surface`. */
  readonly surfaceClassName?: string;
  /** @deprecated Use `viewerSession.validate`. Removed in 0.7.0. */
  readonly validateSession?: (value: unknown) => value is TSession;
  /** @deprecated Use `viewerSession.toState`. Removed in 0.7.0. */
  readonly mapSessionToData?: (session: TSession) => TData | Promise<TData>;
  /** @deprecated Use `viewerSession.onInvalid`. Removed in 0.7.0. */
  readonly onInvalidSession?: (value: unknown) => void;
  /** Extra class on the rendered `StateMessage`, for viewer-owned styling hooks. */
  readonly statusClassName?: string;
  /** Replace the `StateMessage` bridge with a viewer-owned status renderer. */
  readonly renderStatus?: (status: SurfaceStatus) => Node;
}

/**
 * Start a result-driven MCP App whose statuses render through the Preact
 * `StateMessage`. Everything else is `startSurfaceApp`; the shell keeps the
 * `mcp-view-preact-surface` class 0.5 viewers style.
 */
export async function startPreactSurfaceApp<TData, TSession = never>(
  options: PreactSurfaceAppOptions<TData, TSession>,
  runtime?: SurfaceAppRuntime,
): Promise<SurfaceAppHandle<TData>> {
  const {
    validateSession,
    mapSessionToData,
    onInvalidSession,
    statusClassName,
    renderStatus,
    viewerSession,
    surfaceClassName = "mcp-view-preact-surface",
    ...rest
  } = options;
  const resolvedSession = deprecatedViewerSession(
    { validateSession, mapSessionToData, onInvalidSession },
    viewerSession,
  );
  return await startSurfaceApp<TData, TSession>({
    ...rest,
    surfaceClassName,
    ...(resolvedSession ? { viewerSession: resolvedSession } : {}),
    renderStatus: renderStatus ?? ((status) =>
      renderStatusMessage(status.message, {
        title: status.title,
        tone: status.tone,
        busy: status.busy,
        className: statusClassName,
      })),
  }, runtime);
}

interface DeprecatedSessionOptions<TData, TSession> {
  readonly validateSession?: (value: unknown) => value is TSession;
  readonly mapSessionToData?: (session: TSession) => TData | Promise<TData>;
  readonly onInvalidSession?: (value: unknown) => void;
}

/** The deprecated pair keeps working for one minor; mixing the two forms is a mistake. */
function deprecatedViewerSession<TData, TSession>(
  legacy: DeprecatedSessionOptions<TData, TSession>,
  viewerSession: SurfaceViewerSession<TData, TSession> | undefined,
): SurfaceViewerSession<TData, TSession> | undefined {
  const { validateSession, mapSessionToData, onInvalidSession } = legacy;
  const requested = validateSession !== undefined || mapSessionToData !== undefined ||
    onInvalidSession !== undefined;
  if (!requested) return viewerSession;
  if (viewerSession) {
    throw new SurfaceAppError(
      "SURFACE_APP_SESSION_CONFLICT",
      "startPreactSurfaceApp accepts either viewerSession or the deprecated " +
        "validateSession/mapSessionToData pair, not both",
      { recovery: "Move validateSession/mapSessionToData/onInvalidSession into viewerSession." },
    );
  }
  if (!validateSession || !mapSessionToData) {
    throw new SurfaceAppError(
      "SURFACE_APP_SESSION_INCOMPLETE",
      "startPreactSurfaceApp requires both validateSession and mapSessionToData",
      { recovery: "Pass both, or the viewerSession { validate, toState } pair." },
    );
  }
  return {
    validate: validateSession,
    toState: async (session) => ({ kind: "result", result: await mapSessionToData(session) }),
    ...(onInvalidSession ? { onInvalid: onInvalidSession } : {}),
  };
}
