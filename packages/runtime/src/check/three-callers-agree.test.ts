import { ALL_CAPABILITIES } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin, z } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./index.js";

/** One action taking the two keys the cases are typos of, and `env` to read. */
const plugin = definePlugin({
  name: "@t/build",
  namespace: "build",
  actions: [
    defineAction({
      name: "run",
      params: z.object({ token: z.string().optional(), outputdir: z.string().optional() }),
      run: () => undefined,
    }),
  ],
});

const registry = buildRegistry({
  plugins: [plugin, definePlugin({ name: "venn/env", namespace: "env" })],
  caps: ALL_CAPABILITIES,
});

/** Every sentence the checker says, help included, since the hint lives in both. */
function said(source: string, env?: readonly string[]): string {
  const { ast } = parse(source);
  const problems = checkDocument({
    document: ast,
    registry,
    fragments: new Set(collectFragments(ast).keys()),
    env,
  });
  return problems.map((one) => `${one.title} ${one.help ?? ""}`).join("\n");
}

/** A name nothing binds, beside the name it is one edit family away from. */
function unbound(written: string, real: string): string {
  return said(`flow "f" { step "s" { const ${real} = 1\nexpect ${written} } }`);
}

/** The same misspelling as an `env` read, which is a different checker. */
function envRead(written: string, real: string): string {
  const source = `import { env } from "venn/env"\nflow "f" { step "s" { expect env.${written} } }`;
  return said(source, [real]);
}

/** And as an option key, which is a third. */
function optionKey(written: string): string {
  return said(
    `import { build } from "@t/build"\nflow "f" { step "s" { build.run { ${written}: "x" } } }`,
  );
}

/** A run event nobody fires, where a wrong guess replaces the list of real ones. */
function lifecycle(written: string): string {
  return said(`on ${written} { step "s" { log "x" } }`);
}

/**
 * The three places the language says "did you mean" used to hold three cutoffs.
 *
 * `tkn` was suggested by the option checker and the `env` checker and refused
 * by the unbound-name checker, so a typo got a fix in the terminal and silence
 * in the editor. `outdir` went the other way: only the option checker offered
 * `outputdir`, on the strength of rewriting half a six-letter key.
 *
 * Asserted through the checker rather than against `nearestName`, because the
 * sentence is what a user compares, and the three ways to reach it are exactly
 * what disagreed.
 */
describe("did you mean, from every checker that says it", () => {
  it("offers the same near miss on a short name in all three", () => {
    expect(unbound("tkn", "token")).toContain("Did you mean `token`?");
    expect(envRead("tkn", "token")).toContain('Did you mean "env.token"?');
    expect(optionKey("tkn")).toContain('Did you mean "token"?');
  });

  it("refuses the same far miss in all three", () => {
    expect(unbound("outdir", "outputdir")).not.toContain("Did you mean");
    expect(envRead("outdir", "outputdir")).not.toContain("Did you mean");
    expect(optionKey("outdir")).not.toContain("Did you mean");
  });

  it("still says what exists when it has nothing to suggest", () => {
    expect(optionKey("outdir")).toContain("Accepted: token, outputdir.");
    expect(unbound("outdir", "outputdir")).toContain("Bind it with `const` or `let`");
  });
});

/**
 * Two edits is the whole of a two-letter name and two thirds of a three-letter
 * one, so a floor of two on its own offered `y` for `x` and `set` for `sum`.
 * Single- and two-letter locals are ordinary in real flows, and none of these
 * said "did you mean" before the three cutoffs became one.
 */
describe("a name too short for a guess to be worth making", () => {
  it.each([
    ["x", "y"],
    ["up", "id"],
    ["sum", "set"],
  ])("offers nothing for `%s` written beside `%s`", (written, real) => {
    expect(unbound(written, real)).not.toContain("Did you mean");
  });

  it("still prints every run event rather than guessing at one of them", () => {
    const found = lifecycle("sup");

    expect(found).not.toContain("Did you mean");
    expect(found).toContain("The events are: failure, success, retry, timeout, skip, step.");
  });
});
