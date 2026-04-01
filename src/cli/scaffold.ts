/**
 * CLI scaffold command for MCP Apps Bridge.
 *
 * Generates the boilerplate files needed to create a new MCP App
 * with platform adapter integration.
 *
 * This is a placeholder. The CLI will be implemented after the core
 * library is stable.
 */

/** Scaffold options. */
export interface ScaffoldOptions {
  /** Target directory for the new project. */
  readonly outputDir: string;
  /** Platform adapters to include. */
  readonly platforms: readonly ("telegram" | "line")[];
  /** Project name. */
  readonly name: string;
}

/**
 * Generate scaffold files for a new MCP App project.
 *
 * @throws {Error} Always — not yet implemented.
 */
export function scaffold(_options: ScaffoldOptions): Promise<void> {
  throw new Error(
    "[Scaffold] Not yet implemented. " +
      "The scaffold CLI will be built after the core library is stable.",
  );
}
