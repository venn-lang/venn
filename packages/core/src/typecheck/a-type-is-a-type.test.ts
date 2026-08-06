import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const NEWLINE = String.fromCharCode(10);

/** Every problem a source reports, as `CODE title`. */
function said(...lines: string[]): string[] {
  const source = lines.join(NEWLINE);
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

/**
 * A `type` names a type, not an abbreviation for one.
 *
 * `type Meters = number` and `type Feet = number` used to be one type with two
 * spellings, so a `fn` taking two `Meters` took a `Feet` for one of them and
 * thirty feet plus ten metres answered forty. The annotation read like a promise
 * and kept none of it, which is worse than having no annotation at all, because
 * a reader believes it.
 *
 * The rule is about which side carries a name, and only refuses when both do:
 * a shape nobody named flows into a name, a name flows into the shape under it,
 * and only one name in another name's place is refused.
 */
describe("a name and the shape under it", () => {
  it("refuses one name where another is wanted, though the shapes agree", () => {
    expect(
      said(
        "type Meters = number",
        "type Feet = number",
        "fn addUp(a: Meters, b: Meters) -> number => a + b",
        "const h: Feet = 30",
        "const w: Meters = 10",
        "print addUp(h, w)",
      ),
    ).toEqual(["VN3010 Type mismatch: expected Meters, found Feet."]);
  });

  it("refuses a record of one name where another is wanted", () => {
    expect(
      said(
        "type Sale { seller: string }",
        "type Person { seller: string }",
        'const a: Sale = { seller: "ana" }',
        "const b: Person = a",
        "print b.seller",
      ),
    ).toEqual(["VN3010 Type mismatch: expected Person, found Sale."]);
  });

  /** The half that must not break: data arrives as a literal, not as a name. */
  it("lets a shape nobody named flow into a name", () => {
    expect(
      said(
        "type Sale { seller: string, amount: number }",
        'const a: Sale = { seller: "ana", amount: 1 }',
        "print a.seller",
      ),
    ).toEqual([]);
  });

  /** The other half: a name is still the thing underneath when it is used. */
  it("lets a name flow into the shape under it", () => {
    expect(
      said(
        "type Meters = number",
        "fn twice(n: number) -> number => n + n",
        "const w: Meters = 10",
        "print twice(w)",
      ),
    ).toEqual([]);
  });

  /**
   * A union a reader declares is a name over other names, so the members have
   * to fit it. Without this the one place a name is most useful would be the
   * one place it could not be used.
   */
  it("takes a named member into the named union that holds it", () => {
    expect(
      said(
        'type Ping { kind: "ping" }',
        'type Text { kind: "text", body: string }',
        "type Message = Ping | Text",
        "fn saw(m: Message) -> string => m.kind",
        'const p: Ping = { kind: "ping" }',
        "print saw(p)",
      ),
    ).toEqual([]);
  });

  /** Two unions of the same members are still two types, which is the point. */
  it("refuses one named union where another is wanted", () => {
    expect(
      said(
        'type Plan = "free" | "pro"',
        'type Tier = "free" | "pro"',
        'fn priceOf(p: Plan) -> number => p == "pro" ? 12 : 0',
        'const t: Tier = "pro"',
        "print priceOf(t)",
      ),
    ).toEqual(["VN3010 Type mismatch: expected Plan, found Tier."]);
  });

  /** The same name is the same type, however many files it passes through. */
  it("takes a name where its own name is wanted", () => {
    expect(
      said(
        "type Sale { seller: string }",
        "fn who(s: Sale) -> string => s.seller",
        'const a: Sale = { seller: "ana" }',
        "print who(a)",
      ),
    ).toEqual([]);
  });

  /** A plugin's answer is `dynamic`, and dynamic still fits a name. */
  it("lets what the checker cannot see flow into a name", () => {
    expect(
      said(
        'import { json } from "venn/json"',
        "type Sale { seller: string }",
        'const a: Sale = json.parse("{}")',
        "print a.seller",
      ),
    ).toEqual([]);
  });
});
