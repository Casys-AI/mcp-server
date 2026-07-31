/**
 * HTML renderer module.
 *
 * @module renderer
 */

export { renderComposite } from "./html-generator.ts";
export { resolveRendererSlots } from "./html-generator.ts";
export type {
  RenderCompositeOptions,
  RendererSlotCapabilities,
  RendererSlotOptions,
  ResolvedRendererSlotOptions,
} from "./options.ts";
