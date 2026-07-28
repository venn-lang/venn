// @venn-lang/cli: the `venn` binary (process boundary) plus the embeddable runFile.
// The only package that touches node:* and binds concrete implementations.

export { runCommand, verifyPluginCommand } from "./commands/index.js";
export { createStdoutSink, reportProblems } from "./reporters/index.js";
export type { RunFileOutcome } from "./run/run-file.js";
export { runFile } from "./run/run-file.js";
