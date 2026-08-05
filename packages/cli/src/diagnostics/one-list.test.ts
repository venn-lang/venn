import type { Problem } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createDiagnostics } from "./one-list.js";

function problem(args: {
  code: string;
  uri: string;
  offset: number;
  title?: string;
  severity?: Problem["severity"];
}): Problem {
  return {
    code: args.code,
    severity: args.severity ?? "error",
    title: args.title ?? "wrong",
    span: { uri: args.uri, offset: args.offset, length: 1, line: 1, column: 1 },
  };
}

const AT = (offset: number, code = "VN3010") => problem({ code, uri: "a.vn", offset });

/**
 * A person reads a file from the top and fixes the first thing that is wrong.
 * The analysis hands its problems over loudest first, which put an error halfway
 * down a file ahead of a hint at the top of it.
 */
describe("what order a file's problems are printed in", () => {
  it("puts them where they are written, whatever order they were found in", () => {
    const list = createDiagnostics();

    const said = list.unsaid([AT(300), AT(20), AT(140)]);

    expect(said.map((one) => one.span.offset)).toEqual([20, 140, 300]);
  });

  it("keeps a hint at the top of a file in front of an error below it", () => {
    const list = createDiagnostics();
    const hint = problem({ code: "VN5005", uri: "a.vn", offset: 0, severity: "hint" });

    const said = list.unsaid([AT(400), hint]);

    expect(said.map((one) => one.code)).toEqual(["VN5005", "VN3010"]);
  });

  /** One file at a time, so the walk's order across files is what survives. */
  it("groups by file", () => {
    const list = createDiagnostics();

    const said = list.unsaid([problem({ code: "VN1", uri: "b.vn", offset: 1 }), AT(9)]);

    expect(said.map((one) => one.span.uri)).toEqual(["a.vn", "b.vn"]);
  });

  /** Two problems on one character, both worth saying: only the words differ. */
  it("keeps two different things said about the same character", () => {
    const list = createDiagnostics();
    const other = problem({ code: "VN3010", uri: "a.vn", offset: 5, title: "something else" });

    expect(list.unsaid([AT(5), other])).toHaveLength(2);
  });
});

/**
 * A cycle is found from every file that leads into it, and it is one mistake
 * however many found it. `venn check` de-duplicated its own walk and `venn test`
 * did not, so one project gave two counts.
 */
describe("what a command says twice", () => {
  it("says the same problem once, however many files reach it", () => {
    const list = createDiagnostics();

    const first = list.unsaid([AT(11)]);
    const again = list.unsaid([AT(11)]);

    expect(first).toHaveLength(1);
    expect(again).toEqual([]);
  });

  it("says it once when one file reports it twice", () => {
    const list = createDiagnostics();

    expect(list.unsaid([AT(11), AT(11)])).toHaveLength(1);
  });

  /** A second command is a second answer: nothing is remembered between them. */
  it("starts again for the next command", () => {
    createDiagnostics().unsaid([AT(11)]);

    expect(createDiagnostics().unsaid([AT(11)])).toHaveLength(1);
  });
});
