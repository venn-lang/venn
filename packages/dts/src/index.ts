// @venn-lang/dts: the types an installed npm package publishes, read through the
// TypeScript compiler. Node-only, since it loads the compiler itself.
export { type Conversion, toSpec } from "./convert/index.js";
export { type PackageTypes, readPackageTypes } from "./read-package-types.js";
