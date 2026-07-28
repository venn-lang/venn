import type { MockState } from "./mock-state.types.js";

/**
 * Builds an empty mock state: no mocks, no interceptors, no flags, clock live.
 *
 * @returns A state nothing else holds. `getMockState` returns the shared one
 * the verbs actually read.
 */
export function createMockState(): MockState {
  return {
    mocks: new Map(),
    intercepts: [],
    flags: new Map(),
    frozenInstant: undefined,
  };
}
