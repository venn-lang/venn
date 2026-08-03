import { createMockState } from "./create-mock-state.js";
import type { MockState } from "./mock-state.types.js";

let shared: MockState = createMockState();

/**
 * The mock state every `mock` verb reads and writes.
 *
 * One state at a time, given back at the start of every flow, so what a flow
 * mocks, flags or freezes is the flow's own and no later flow reads it back.
 *
 * @returns The live state. It is mutable: writing to it is how the verbs work.
 */
export function getMockState(): MockState {
  return shared;
}

/**
 * Replaces the state with an empty one. Backs `mock.reset`, and is what the
 * plugin hands the runner as its `atFlowStart`.
 *
 * Callers holding the object from a previous {@link getMockState} keep the old
 * one, which no verb reads any more.
 */
export function resetMockState(): void {
  shared = createMockState();
}
