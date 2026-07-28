import { type ActionDefinition, type ActionInput, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { getMockState, type NamedMock, resetMockState } from "../state/index.js";

/**
 * `mock.start("payments", { from: "openapi.yaml" })`: register a named mock
 * service. Starting a name twice replaces the earlier registration.
 */
export const start: ActionDefinition = defineAction({
  name: "start",
  doc: "Register a named mock service.",
  params: z.object({ from: z.string().optional() }).optional(),
  args: [arg("name", t.string, "What to call this mock, so it can be reached later.")],
  result: t.ref("mock.Mock"),
  run: (_ctx, input) => startMock(input),
});

function startMock(input: ActionInput<unknown>): NamedMock {
  const params = (input.params ?? {}) as { from?: string };
  const name = String(input.args[0] ?? "");
  const mock: NamedMock = { name, from: params.from };
  getMockState().mocks.set(name, mock);
  return mock;
}

/** `mock.stop()`: clear the active mocks and interceptors. Flags and clock survive. */
export const stop: ActionDefinition = defineAction({
  name: "stop",
  doc: "Clear all registered mocks and interceptors.",
  result: t.void,
  run: () => stopMocks(),
});

function stopMocks(): void {
  const state = getMockState();
  state.mocks.clear();
  state.intercepts.length = 0;
}

/** `mock.reset()`: clear every piece of mock state, the flags and the clock included. */
export const reset: ActionDefinition = defineAction({
  name: "reset",
  doc: "Reset all mock state to empty.",
  result: t.void,
  run: () => resetMockState(),
});
