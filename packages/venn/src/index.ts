// @venn-lang/venn: the binary. Resolves which version of the language a
// directory wants, installs it if absent, and hands the command over. Carries
// no compiler, which `carries-no-language.mjs` checks on every build.
export { handOver } from "./hand-over.js";
export { run } from "./run.js";
