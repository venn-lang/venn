export { closureOfDecl, compileExpr } from "./compile.js";
export type { Compile, CompiledBody, CompiledLocal, Thunk } from "./compile.types.js";
export { constLit, pureBodyCannotCall, RAISES } from "./nodes/index.js";
export { type StopCheck, setStopCheck } from "./stop-check.js";
