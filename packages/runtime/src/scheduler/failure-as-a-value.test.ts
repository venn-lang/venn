import { createTestHost } from "@venn-lang/contracts";
import { checkTypes, parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { checkDocument } from "../check/index.js";
import { createMemorySink } from "../eventsink/index.js";
import { buildRegistry } from "../registry/index.js";
import { createRunner } from "../run/index.js";
import { collectFragments } from "./index.js";

const NEWLINE = String.fromCharCode(10);

async function ran(lines: string[]): Promise<string[]> {
  const out: string[] = [];
  const printer = definePlugin({
    name: "@t/io",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => void out.push(input.args.map(String).join(" ")),
      }),
    ],
  });
  const runner = createRunner({
    host: createTestHost(),
    plugins: [printer],
    sink: createMemorySink(),
  });
  await runner.script(parse(lines.join(NEWLINE)).ast);
  return out;
}

/** Every code `venn check` would report over this source. */
function codes(lines: string[]): string[] {
  const document = parse(lines.join(NEWLINE)).ast;
  const registry = buildRegistry({ plugins: [], caps: createTestHost().caps });
  const found = checkDocument({
    document,
    registry,
    fragments: new Set(collectFragments(document).keys()),
  });
  return [...found, ...checkTypes(document).problems].map((one) => one.code);
}

/**
 * A failure a program can tell apart from another.
 *
 * `fail` always raised the one code, so a library could not raise a failure a
 * caller could recognise, and what `catch` bound was two fields with no type on
 * them.
 */
describe("raising a failure of one's own", () => {
  it("carries the code it was given", async () => {
    const lines = [
      "try {",
      '  fail "the card said no" { code: "pay.declined" }',
      "} catch e {",
      "  io.print(e.code)",
      "}",
    ];

    expect(await ran(lines)).toEqual(["pay.declined"]);
  });

  it("carries what was attached to it", async () => {
    const lines = [
      "try {",
      '  fail "empty" { code: "cart.empty", data: { items: 0 } }',
      "} catch e {",
      "  io.print(e.data.items)",
      "}",
    ];

    expect(await ran(lines)).toEqual(["0"]);
  });

  it("says where it was raised", async () => {
    const lines = ["try {", '  fail "no"', "} catch e {", "  io.print(e.where)", "}"];
    const said = (await ran(lines))[0] ?? "";

    expect(said).toContain(":2:3");
  });

  /** Which is the whole point: two failures, told apart by the one catching them. */
  it("lets a catch decide which failure it caught", async () => {
    const lines = [
      "fragment charge(amount) {",
      "  if amount > 100 {",
      '    fail "too much" { code: "pay.limit" }',
      "  }",
      '  fail "declined" { code: "pay.declined" }',
      "}",
      "try {",
      "  run charge(500)",
      "} catch e {",
      '  io.print(e.code == "pay.limit" ? "wait" : "give up")',
      "}",
    ];

    expect(await ran(lines)).toEqual(["wait"]);
  });

  it("keeps its own code when nobody gave it one", async () => {
    const lines = ["try {", '  fail "just no"', "} catch e {", "  io.print(e.code)", "}"];

    expect(await ran(lines)).toEqual(["VN6002"]);
  });

  /**
   * `docs` was declared on `Problem`, printed by the reporter, published to
   * programs as `error.docs`, and produced by nobody, so every failure in the
   * language answered it with nothing. `buildProblem` derives it from the code
   * it already holds, which is the one place that cannot go stale.
   */
  it("says where to read more about the code the language gave it", async () => {
    const lines = ["try {", '  fail "just no"', "} catch e {", "  io.print(e.docs)", "}"];

    expect(await ran(lines)).toEqual(["https://venn.dev/e/VN6002"]);
  });

  /** A code the program chose has no page, and a dead link is worse than none. */
  it("says nothing for a code of the program's own", async () => {
    const lines = [
      "try {",
      '  fail "no" { code: "pay.declined" }',
      "} catch e {",
      "  io.print(e.docs)",
      "}",
    ];

    expect(await ran(lines)).toEqual(["null"]);
  });
});

/**
 * Codes beginning `VN` belong to the language. A program raising `VN7010` to
 * mean its own thing is a program whose failures cannot be told from the ones
 * the language raises.
 */
describe("claiming a code the language owns", () => {
  it("is refused where it is written", () => {
    expect(codes(['fail "no" { code: "VN7010" }'])).toContain("VN3022");
  });

  it("is refused however it is spelled", () => {
    expect(codes(['fail "no" { code: "vn1001" }'])).toContain("VN3022");
  });

  it("is refused when the run reaches one nobody wrote out", async () => {
    const lines = [
      'const digits = "7010"',
      'const chosen = "VN${digits}"',
      "try {",
      '  fail "no" { code: chosen }',
      "} catch e {",
      "  io.print(e.code)",
      "}",
    ];

    expect(await ran(lines)).toEqual(["VN3022"]);
  });

  /**
   * The help says to name it after what happened, so this asserts the program a
   * reader gets by following it reports NOTHING, rather than merely not VN3022.
   * A rewrite that trades one refusal for another is not advice.
   */
  it("leaves a code of the program's own alone", () => {
    expect(codes(['fail "no" { code: "pay.declined" }'])).toEqual([]);
  });
});

describe("what the checker knows about a caught failure", () => {
  it("refuses a member it does not have", () => {
    const lines = ["try {", '  fail "no"', "} catch e {", "  io.print(e.nowhere)", "}"];

    expect(codes(lines)).toContain("VN3010");
  });

  it("knows the members it does have", () => {
    const lines = [
      "try {",
      '  fail "no"',
      "} catch e {",
      "  io.print(e.code, e.message, e.where, e.help, e.docs, e.data)",
      "}",
    ];

    expect(codes(lines)).not.toContain("VN3010");
  });

  it("knows them in the expression form as well", () => {
    expect(codes(['const said = try 1 else "x"', "const n = said"])).not.toContain("VN3010");
    expect(codes(["const said = try 1 catch e => e.nowhere"])).toContain("VN3010");
  });
});
