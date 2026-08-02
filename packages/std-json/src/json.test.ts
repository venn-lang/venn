import type { ActionContext } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { jsonPlugin } from "./plugin.js";

const actions = jsonPlugin.actions ?? [];

/** Run one verb on some text, the way a program written in Venn would. */
function run(name: string, text: unknown): unknown {
  const found = actions.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`json.${name} is not a verb`);
  return found.run({} as ActionContext, { args: [text], params: {} });
}

describe("reading JSON", () => {
  it("reads an object, a list and a scalar", () => {
    expect(run("parse", '{ "a": 1 }')).toEqual({ a: 1 });
    expect(run("parse", "[1, 2]")).toEqual([1, 2]);
    expect(run("parse", '"text"')).toBe("text");
    expect(run("parse", "null")).toBeNull();
  });

  it("reads what is nested, all the way down", () => {
    expect(run("parse", '{ "a": { "b": [1, { "c": true }] } }')).toEqual({
      a: { b: [1, { c: true }] },
    });
  });

  /** An offset is a number nobody can find; a line and a column is where to look. */
  it("says which line and column it stopped at", () => {
    const text = '{\n  "a": 1,\n}';

    expect(() => run("parse", text)).toThrow(/line 3 column 1/);
  });

  /** Where the runtime names no position, it quotes the text around it instead. */
  it("quotes the text when there is no position to give", () => {
    expect(() => run("parse", '{ "b": oops }')).toThrow(/near/);
  });

  /** The code a program reads to tell this failure from another. */
  it("carries the code for a payload it could not read", () => {
    try {
      run("parse", "{ oops");
      throw new Error("parse raised nothing");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("VN7003");
    }
  });

  it("says it is not JSON, in those words", () => {
    expect(() => run("parse", "{")).toThrow(/This is not JSON/);
  });

  it("refuses nothing at all, rather than reading it as something", () => {
    expect(() => run("parse", "")).toThrow(/This is not JSON/);
  });
});

describe("reading what nobody promised was JSON", () => {
  it("answers with the value when it is", () => {
    expect(run("tryParse", '{ "a": 1 }')).toEqual({ a: 1 });
  });

  it("answers with nothing when it is not", () => {
    expect(run("tryParse", "not json")).toBeNull();
    expect(run("tryParse", "")).toBeNull();
  });

  /** `null` is a value JSON can hold, and this cannot tell the two apart. */
  it("answers with nothing for the text that says nothing", () => {
    expect(run("tryParse", "null")).toBeNull();
  });

  it("says whether text is JSON without keeping what it says", () => {
    expect(run("isValid", '{ "a": 1 }')).toBe(true);
    expect(run("isValid", "{")).toBe(false);
  });
});

describe("what the namespace publishes", () => {
  it("types every verb it has", () => {
    const untyped = actions.filter((action) => !action.signature);

    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  it("does not render, which is the other namespace's half", () => {
    expect(actions.map((action) => action.name).sort()).toEqual(["isValid", "parse", "tryParse"]);
  });
});
