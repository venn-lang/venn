import { describe, expect, it } from "vitest";
import { isPrelude, PRELUDE, PRELUDE_TYPES, preludeValues, preludeVerbs } from "./prelude.js";

/**
 * The list itself, held to what it promises: this package is the answer to what
 * comes native, so a name that is here and nowhere else, or the other way round,
 * is the answer being wrong.
 */
describe("what the language brings with it", () => {
  it("knows a name it has, and one it does not", () => {
    expect(isPrelude("print")).toBe(true);
    expect(isPrelude("http")).toBe(false);
  });

  it("splits into values and verbs, with every name in one of them", () => {
    const both = [...preludeValues(), ...preludeVerbs()].sort();

    expect(both).toEqual(Object.keys(PRELUDE).sort());
  });

  it("carries the types that are not primitives", () => {
    expect(PRELUDE_TYPES.regex).toEqual(expect.objectContaining({ kind: "opaque", name: "regex" }));
    expect(PRELUDE_TYPES.task).toEqual(expect.objectContaining({ kind: "opaque", name: "task" }));
  });

  it("describes every name with something a reader can use", () => {
    for (const [name, entry] of Object.entries(PRELUDE)) {
      expect(entry.doc.length, name).toBeGreaterThan(20);
      expect(entry.type, name).toBeDefined();
    }
  });

  /**
   * A verb has nowhere to give a value back to, so none of them claims one.
   *
   * `null`, and nothing else. `fail` and `exit` printed `-> never`, a type name
   * the language does not have: the editor offers and explains what is in
   * `BUILTIN_TYPES`, `never` is not in it and cannot be without making
   * `const x: never = 1` check clean, and a signature that prints a name the
   * editor can then say nothing about is a dead end for whoever reads it.
   */
  it("gives every verb a signature that answers with nothing", () => {
    for (const name of preludeVerbs()) {
      expect(PRELUDE[name]?.signature, name).toMatch(/-> null$/);
    }
  });
});
