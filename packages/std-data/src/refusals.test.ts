import type { ActionContext, ActionDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { dataActions } from "./actions/index.js";

const ctx = {} as ActionContext;

function run(name: string, ...args: unknown[]): unknown {
  const action = dataActions.find((candidate: ActionDefinition) => candidate.name === name);
  if (!action) throw new Error(`no action ${name}`);
  return action.run(ctx, { args, params: {} });
}

/** What was raised, so the code it carries can be read rather than its shape. */
function thrown(name: string, ...args: unknown[]): { code?: string; message?: string } {
  try {
    run(name, ...args);
  } catch (error) {
    return error as { code?: string; message?: string };
  }
  throw new Error(`${name} raised nothing`);
}

/**
 * What a verb does when the caller asked for something impossible.
 *
 * These three answered anyway. A range whose end is below its start gave a
 * number outside both ends, choosing from nothing gave nothing, and text that
 * was not JSON came back as whatever the runtime threw. All three are the
 * program being wrong, and the run ending at the mistake is the shortest way to
 * the fix.
 */
describe("an argument a verb cannot work with", () => {
  it("refuses a range whose end is below its start", () => {
    expect(thrown("range", 10, 1)).toMatchObject({
      code: "VN7005",
      message: "There is no range from 10 to 1.",
    });
  });

  it("takes a range of one, which is a range", () => {
    expect(run("range", 4, 4)).toBe(4);
  });

  it("refuses to choose from nothing", () => {
    expect(thrown("oneOf")).toMatchObject({
      code: "VN7005",
      message: "`data.oneOf` needs something to choose from.",
    });
  });

  it("chooses from one, which is a choice", () => {
    expect(run("oneOf", "only")).toBe("only");
  });
});

/**
 * Text that was promised to be JSON and is not.
 *
 * `json.tryParse` is for text nobody promised anything about. This one ends the
 * run, and says so in the language's words rather than handing over whatever
 * the runtime threw.
 */
describe("text that is not the JSON it was said to be", () => {
  it("ends the run, with a code and a message of its own", () => {
    const failure = thrown("json", "{ oops");

    expect(failure.code).toBe("VN7003");
    expect(failure.message).toMatch(/^This is not JSON: /);
  });

  it("reads the JSON it was given", () => {
    expect(run("json", '{ "port": 443 }')).toEqual({ port: 443 });
  });

  /** Nothing to read is nothing, which is what `null` is the JSON for. */
  it("reads nothing as nothing", () => {
    expect(run("json")).toBeNull();
  });
});
