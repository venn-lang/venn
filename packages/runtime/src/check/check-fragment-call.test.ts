import { ALL_CAPABILITIES } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

const HEAD = `fragment entrar(u) {
  step "login" { expect u == "ada" }
}

fn dobro(x: number) -> number => x * 2
`;

function problems(body: string): string[] {
  const { ast } = parse(HEAD + body, { uri: "/main.vn" });
  const registry = buildRegistry({ plugins: [], caps: ALL_CAPABILITIES });
  return checkDocument({
    document: ast,
    registry,
    fragments: new Set(collectFragments(ast).keys()),
    uri: "/main.vn",
  }).map((problem) => `${problem.code} ${problem.title}`);
}

/**
 * A fragment written as though it were a function.
 *
 * The two look alike where they are written and are not the same kind of thing:
 * a `fn` gives back a value, a `fragment` gives back steps, and steps happen,
 * are recorded, can fail. Unreported, the line checks clean and the run answers
 * "this value is not a function" about something the reader wrote three lines up
 * and can plainly see is one.
 */
describe("calling a fragment for a value", () => {
  it("is reported where it is written", () => {
    const found = problems('flow "f" { step "s" { expect entrar("ada") == 1 } }');

    expect(found).toEqual(["VN3013 entrar is a fragment, so it cannot be called for a value."]);
  });

  /** The message has to carry the fix: the reader wrote the right name. */
  it("says how to invoke it instead", () => {
    const { ast } = parse(`${HEAD}flow "f" { step "s" { expect entrar("a") == 1 } }`, {
      uri: "/main.vn",
    });
    const registry = buildRegistry({ plugins: [], caps: ALL_CAPABILITIES });
    const found = checkDocument({
      document: ast,
      registry,
      fragments: new Set(collectFragments(ast).keys()),
      uri: "/main.vn",
    });

    expect(found[0]?.note).toContain("run entrar(");
  });

  it("leaves `run` alone — that is how a fragment is invoked", () => {
    expect(problems('flow "f" { run entrar("ada") }')).toEqual([]);
  });

  it("leaves an ordinary function call alone", () => {
    expect(problems('flow "f" { step "s" { expect dobro(2) == 4 } }')).toEqual([]);
  });
});
