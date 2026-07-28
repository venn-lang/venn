import type {
  SignalHandler,
  SignalSource,
  SystemSignal,
  Unsubscribe,
} from "./signal-source.types.js";

/** A {@link SignalSource} with the bell a test rings. */
export interface FakeSignals extends SignalSource {
  /** Deliver `signal` to everyone still listening for it. */
  raise(signal: SystemSignal): void;
  /** Which signals are currently being listened for, for assertions. */
  readonly listening: readonly SystemSignal[];
}

/**
 * The double: a signal arrives because a test said so. No process, no operating
 * system, no risk of stopping the test runner along with the code under test.
 */
export function createFakeSignals(): FakeSignals {
  const handlers = new Map<SystemSignal, Set<SignalHandler>>();
  return {
    get listening() {
      return [...handlers].filter(([, set]) => set.size > 0).map(([signal]) => signal);
    },
    on: (signal, handler) => subscribe({ handlers, signal, handler }),
    raise: (signal) => {
      for (const handler of [...(handlers.get(signal) ?? [])]) handler(signal);
    },
  };
}

function subscribe(args: {
  handlers: Map<SystemSignal, Set<SignalHandler>>;
  signal: SystemSignal;
  handler: SignalHandler;
}): Unsubscribe {
  const set = args.handlers.get(args.signal) ?? new Set<SignalHandler>();
  set.add(args.handler);
  args.handlers.set(args.signal, set);
  return () => {
    set.delete(args.handler);
  };
}
