import { createTestHost } from "@venn-lang/contracts";
import { checkTypes, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";
import { type ModuleIo, resolveImports } from "./resolve-imports.js";

const NEWLINE = String.fromCharCode(10);

const LIB: Record<string, string> = {
  "/shop.vn": `pub namespace coupon {
  const rate = 0.3
  pub fn apply(total) => total * (1 - rate)
}`,
};

const io: ModuleIo = {
  read: async (uri) => LIB[uri] ?? Promise.reject(new Error("not found")),
  resolve: (_from, spec) => spec.replace(/^\./, ""),
};

/** Run a program and give back what it logged. */
async function ran(...lines: string[]): Promise<string[]> {
  const { ast, problems } = parse(lines.join(NEWLINE), { uri: "/main.vn" });
  expect(problems.map((one) => one.title)).toEqual([]);
  const resolved = await resolveImports({ document: ast, uri: "/main.vn", io });
  const sink = createMemorySink();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [],
    sink,
    uri: "/main.vn",
    moduleFragments: resolved.fragments,
    modules: { modules: resolved.modules, resolve: io.resolve },
  });
  await runner.script(ast);
  return sink.envelopes
    .filter((event) => event.kind === "log")
    .map((event) => String((event.data as { message?: unknown }).message ?? ""));
}

/** Every type problem the checker reports over this source. */
function said(...lines: string[]): string[] {
  return checkTypes(parse(lines.join(NEWLINE)).ast).problems.map((one) => one.title);
}

/**
 * A namespace written in the language.
 *
 * One could be published by a plugin or made by a file, and there was no way to
 * write one: a file grouping two families of names had to become two files. This
 * is a fourth spelling of one thing rather than a fourth thing, so `pub` decides
 * what leaves, exactly as it does in a module.
 */
describe("a namespace a file declares", () => {
  it("answers for what it published", async () => {
    const lines = [
      "namespace coupon {",
      "  pub fn apply(total) => total * 0.7",
      "}",
      "log coupon.apply(100)",
    ];

    expect(await ran(...lines)).toEqual(["70"]);
  });

  it("keeps what it did not publish to itself", async () => {
    const lines = [
      "namespace coupon {",
      "  const rate = 0.3",
      "  pub fn apply(total) => total * (1 - rate)",
      "}",
      "log coupon.apply(100)",
      "log coupon.rate",
    ];

    expect(await ran(...lines)).toEqual(["70", "null"]);
  });

  it("nests, which is why grouping wanted it", async () => {
    const lines = [
      "namespace coupon {",
      "  pub namespace stacking {",
      "    pub fn allowed(a, b) => a != b",
      "  }",
      "}",
      'log coupon.stacking.allowed("a", "b")',
    ];

    expect(await ran(...lines)).toEqual(["true"]);
  });

  it("lets a member read what the file bound", async () => {
    const lines = [
      "const base = 10",
      "namespace prices {",
      "  pub fn of(n) => n * base",
      "}",
      "log prices.of(4)",
    ];

    expect(await ran(...lines)).toEqual(["40"]);
  });

  it("lets a member call another beside it, written either way round", async () => {
    const lines = [
      "namespace m {",
      "  pub fn outer(n) => inner(n) + 1",
      "  fn inner(n) => n * 2",
      "}",
      "log m.outer(10)",
    ];

    expect(await ran(...lines)).toEqual(["21"]);
  });
});

describe("what the checker knows about one", () => {
  it("refuses a member it does not have", () => {
    const lines = ["namespace c {", "  pub fn twice(n) => n * 2", "}", "print c.nope"];

    expect(said(...lines)[0]).toContain('has no field "nope"');
  });

  it("refuses a member it has but did not publish", () => {
    const lines = [
      "namespace c {",
      "  const rate = 1",
      "  pub fn twice(n) => n * 2",
      "}",
      "print c.rate",
    ];

    expect(said(...lines)[0]).toContain('has no field "rate"');
  });

  it("knows what a published member is worth", () => {
    const lines = [
      "namespace c {",
      "  pub fn twice(n) => n * 2",
      "}",
      "const wrong: string = c.twice(1)",
    ];

    expect(said(...lines)[0]).toContain("expected string, found number");
  });

  it("reaches into one written inside another", () => {
    const lines = [
      "namespace outer {",
      "  pub namespace inner {",
      "    pub fn twice(n) => n * 2",
      "  }",
      "}",
      "const wrong: string = outer.inner.twice(1)",
    ];

    expect(said(...lines)[0]).toContain("expected string, found number");
  });

  /** A type is not a value, so it is published as a name and is not a member. */
  it("leaves a type out of what the value answers to", () => {
    const lines = [
      "namespace c {",
      "  pub type Rate = number",
      "  pub fn twice(n) => n * 2",
      "}",
      "print c.Rate",
    ];

    expect(said(...lines)[0]).toContain('has no field "Rate"');
  });

  /** A binding that takes a value apart names more than one thing. */
  it("takes a member bound by taking something apart", () => {
    const lines = [
      "namespace c {",
      "  const { rate } = { rate: 0.3 }",
      "  pub fn apply(n) => n * rate",
      "}",
      "const r: number = c.apply(100)",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("says nothing about a member it does have", () => {
    const lines = ["namespace c {", "  pub const rate = 0.3", "}", "const r: number = c.rate"];

    expect(said(...lines)).toEqual([]);
  });
});

describe("a namespace another file published", () => {
  it("arrives through an import", async () => {
    const lines = ['import { coupon } from "./shop.vn"', "log coupon.apply(100)"];

    expect(await ran(...lines)).toEqual(["70"]);
  });
});
