// @venn/contracts/testing: the conformance harness (TCK). It imports vitest and
// fast-check, so it stays out of the runtime bundle. Any package can run these
// suites against its own implementation.
export type { ConformanceSpec, PortFactory } from "./conformance/index.js";
export { expectVennError } from "./conformance/index.js";
export { clockConformance } from "./ports/clock/clock.suite.js";
export { fileSystemConformance } from "./ports/file-system/file-system.suite.js";
export { lockProviderConformance } from "./ports/lock-provider/lock-provider.suite.js";
export { manifestProviderConformance } from "./ports/manifest-provider/manifest.suite.js";
export { processProviderConformance } from "./ports/process-provider/process-provider.suite.js";
export { randomConformance } from "./ports/random/random.suite.js";
export { secretProviderConformance } from "./ports/secret-provider/secret-provider.suite.js";
export {
  type SignalSpec,
  signalSourceConformance,
} from "./ports/signal-source/signal-source.suite.js";
