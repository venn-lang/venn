import process from "node:process";
import { programTitle } from "./program-title.js";

/**
 * Name the process after the program it is running.
 *
 * Until something says otherwise, Windows reports the executable path (the
 * `node` the terminal tab shows) and puts it back when the process exits. So
 * this is set once and never undone: restoring it by hand would write that path
 * over whatever title the terminal had before, which is worse than doing
 * nothing.
 */
export function setProgramTitle(args: { command: string; target?: string }): void {
  process.title = programTitle(args);
}
