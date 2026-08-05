// biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are Venn source under test, where ${…} is the language's own interpolation.
import { ALL_CAPABILITIES } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin, z } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

// A stand-in for @venn-lang/http: stdlib depends on runtime, so runtime cannot use it.
const plugin = definePlugin({
  name: "@t/http",
  namespace: "http",
  actions: [
    defineAction({
      name: "get",
      params: z.object({
        query: z.record(z.string(), z.string()).optional(),
        bearer: z.string().optional().describe("Shorthand for the Authorization header."),
      }),
      run: () => undefined,
    }),
  ],
});

// `env` is a namespace like any other: reading configuration needs a `use`.
const envPlugin = definePlugin({ name: "venn/env", namespace: "env" });

const registry = buildRegistry({ plugins: [plugin, envPlugin], caps: ALL_CAPABILITIES });

function check(source: string, env?: readonly string[]): string[] {
  const { ast } = parse(source);
  const problems = checkDocument({
    document: ast,
    registry,
    fragments: new Set(collectFragments(ast).keys()),
    env,
  });
  return problems.map((problem) => `${problem.code} ${problem.title}`);
}

const DECLARED = ["BASE_URL", "TOKEN"];

/** Every read of `env` needs the import, so the fixtures carry it. */
function withEnv(body: string): string {
  return `import { env } from "venn/env"\nflow "f" { step "s" { ${body} } }`;
}

describe("env checking", () => {
  it("accepts a declared variable", () => {
    expect(check(withEnv("expect env.BASE_URL"), DECLARED)).toEqual([]);
  });

  it('refuses to read env without `import { env } from "venn/env"`', () => {
    const found = check('flow "f" { step "s" { expect env.BASE_URL } }', DECLARED);

    expect(found[0]).toContain("VN2007");
    expect(found[0]).toContain("not imported in this file");
  });

  it("asks for the import even when the read hides inside a string", () => {
    const found = check('flow "f" { step "s" { expect "${env.BASE_URL}/x" } }', DECLARED);

    expect(found[0]).toContain("VN2007");
  });

  it("rejects an undeclared one, suggesting the nearest declared name", () => {
    const found = check(withEnv("expect env.BASE_UR"), DECLARED);

    expect(found[0]).toContain("VN2006");
    expect(found[0]).toContain('Did you mean "env.BASE_URL"');
  });

  it("catches the typo inside an interpolated string, where env reads actually live", () => {
    expect(check(withEnv('expect "${env.TOKEM}/x"'), DECLARED)[0]).toContain(
      '"env.TOKEM" is not declared',
    );
  });

  it("says nothing about names when no manifest declared anything", () => {
    expect(check(withEnv("expect env.ANYTHING"))).toEqual([]);
  });
});

describe("option checking", () => {
  const call = (opts: string) =>
    `import { http } from "@t/http"\nflow "f" { step "s" { const r = http.get "/x" ${opts} } }`;

  it("accepts the keys the schema declares", () => {
    expect(check(call('{ bearer: "t", query: { page: "1" } }'))).toEqual([]);
  });

  it("rejects a key that does not exist, suggesting the nearest one", () => {
    const found = check(call('{ bearrer: "t" }'));

    expect(found[0]).toContain("VN3001");
    expect(found[0]).toContain('Did you mean "bearer"');
  });

  it("lists what is accepted when nothing is close enough to suggest", () => {
    expect(check(call("{ zzzzzzzz: 1 }"))[0]).toContain("Accepted:");
  });
});
