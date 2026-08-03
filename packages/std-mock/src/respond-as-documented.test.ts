import { describe, expect, it } from "vitest";
import { mockActions } from "./actions/index.js";

const respond = mockActions.find((one) => one.name === "respond");
if (!respond?.run) throw new Error("mock has no `respond`, which is the subject of this file");
const answer = respond.run;

const statusOf = (args: readonly unknown[], params: Record<string, unknown>): number =>
  (answer({} as never, { args, params } as never) as { status: number }).status;

/**
 * The two spellings `packages/std-mock/README.md` shows, held to being legal.
 *
 * Both values may arrive positionally or by name, so neither is required as an
 * argument. Declared required, the argument count refused the verb's own
 * documentation: `mock.respond { status: 201, body: … }` passes nothing
 * positionally and is the spelling the README shows first.
 */
describe("what `mock.respond` says it takes", () => {
  it("reads the status from the position", () => {
    expect(statusOf([201], {})).toBe(201);
  });

  it("reads it from the name, with nothing positional at all", () => {
    expect(statusOf([], { status: 201 })).toBe(201);
  });

  it("answers 200 when neither said otherwise", () => {
    expect(statusOf([], {})).toBe(200);
  });
});
