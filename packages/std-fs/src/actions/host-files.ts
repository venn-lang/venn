import { type FileSystem, FileSystemPort } from "@venn-lang/contracts";
import type { ActionContext } from "@venn-lang/sdk";

/**
 * The disk this host reads and writes, which every verb here defers to.
 *
 * The port is what keeps a filesystem namespace honest in a package that may
 * never import `node:fs`: the CLI binds the real disk, a test binds the double,
 * and the editor's worker binds whatever it has. Reaching for Node here would
 * publish verbs the language server could not load.
 */
export function files(ctx: ActionContext): FileSystem {
  return ctx.port(FileSystemPort);
}

/**
 * One argument as the text of a path.
 *
 * Spelled the way `@venn-lang/path` spells it, so a path built by one namespace
 * and handed to the other is the same string on the way through.
 */
export function pathText(value: unknown): string {
  return String(value ?? "");
}
