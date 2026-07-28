import { basename } from "node:path";

/** How long a title may get before it stops being readable in a tab. */
const MAX = 60;

/**
 * What this process calls itself: `venn run server.vn`, not `node`.
 *
 * The terminal tab is the only place a long-running program announces itself,
 * and "node" says nothing about which program, which file, or whose.
 */
export function programTitle(args: { command: string; target?: string }): string {
  const name = args.target ? basename(args.target) : "";
  return `venn ${args.command}${name ? ` ${name}` : ""}`.slice(0, MAX);
}
