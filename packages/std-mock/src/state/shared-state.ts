import { createMockState } from "./create-mock-state.js";
import type { MockState } from "./mock-state.types.js";

let shared: MockState = createMockState();

/**
 * The mock state every `mock` verb reads and writes.
 *
 * One state per process, so everything running in that process sees the same
 * mocks, flags and clock.
 *
 * @returns The live state. It is mutable: writing to it is how the verbs work.
 */
export function getMockState(): MockState {
  return shared;
}

/**
 * Replaces the shared state with an empty one. Backs `mock.reset`, and lets a
 * test start from a known state.
 *
 * Callers holding the object from a previous {@link getMockState} keep the old
 * one, which no verb reads any more.
 */
export function resetMockState(): void {
  shared = createMockState();
}
