// @venn-lang/types: the language's type vocabulary as plain data.
//
// Zero dependencies on purpose. The compiler, the plugin SDK and the generator
// that reads TypeScript declarations all speak this, and none of them should
// have to depend on the others to do it.

export * from "./derived/index.js";
export * from "./spec/index.js";
