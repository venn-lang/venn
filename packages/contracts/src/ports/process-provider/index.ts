export { createFakeProcess } from "./fake-process.js";
export { ProcessProviderPort } from "./process-provider.port.js";
export type {
  ProcessHandle,
  ProcessProvider,
  ProcessResult,
  SpawnArgs,
} from "./process-provider.types.js";
// node-spawn is deliberately absent: like node-fs it lives behind
// @venn-lang/contracts/node, so this barrel stays Worker-safe.
