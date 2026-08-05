export { createFakeSignals, type FakeSignals } from "./fake-signals.js";
export {
  ALL_SIGNALS,
  type SignalHandler,
  type SignalSource,
  type SystemSignal,
  type Unsubscribe,
} from "./signal-source.types.js";
// node-signals is deliberately absent: it lives behind @venn-lang/contracts/node, so
// this barrel stays Worker-safe.
