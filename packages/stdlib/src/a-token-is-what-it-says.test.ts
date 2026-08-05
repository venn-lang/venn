import { ConsolePort, createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { createMemorySink, createRunner } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";
import { stdlibPortBindings } from "./port-bindings.js";

const NEWLINE = String.fromCharCode(10);

async function run(lines: string[]): Promise<string[]> {
  const { ast, problems } = parse(lines.join(NEWLINE));
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const console = createMemoryConsole();
  const runner = createRunner({
    host: createTestHost(),
    plugins: allPlugins,
    sink: createMemorySink(),
    ports: [{ port: ConsolePort, impl: console }, ...stdlibPortBindings],
  });
  await runner.script(ast);
  return console.out.split(NEWLINE).filter((line) => line !== "");
}

/**
 * `auth` mints a token and `crypto` checks it, in one program.
 *
 * They disagreed. `auth.jwt` merged the caller's header over its default, so
 * `{ alg: "HS512" }` reached the signed bytes, and then signed with SHA-256
 * regardless; `crypto.jwt.verify` read the `alg` the token claimed, hashed with
 * SHA-512 and compared two different digests over identical input. The answer was
 * `false` for a token nothing had tampered with, and the signer's own
 * documentation described the behaviour as though it were a feature.
 *
 * Held here because neither package alone can see it: std-auth's own tests never
 * verify, std-crypto's never sign with the other's signer, and a plugin may not
 * depend on another plugin. This is the only room where both are loaded.
 */
describe("a token is signed with the algorithm it says it is", () => {
  for (const alg of ["HS256", "HS384", "HS512"]) {
    it(`mints an ${alg} token that crypto.jwt.verify accepts`, async () => {
      const lines = await run([
        'import { auth } from "venn/auth"',
        'import { crypto } from "venn/crypto"',
        `const token = auth.jwt { header: { alg: "${alg}" }, payload: { sub: "42" }, secret: "k" }`,
        "const decoded = crypto.jwt.decode token",
        'const ok = crypto.jwt.verify token { secret: "k" }',
        "print decoded.header.alg",
        "print ok",
      ]);

      expect(lines).toEqual([alg, "true"]);
    });
  }

  it("refuses to mint a token under an algorithm nothing here signs with", async () => {
    const lines = await run([
      'import { auth } from "venn/auth"',
      "try {",
      '  auth.jwt { header: { alg: "RS256" }, payload: {}, secret: "k" }',
      "} catch e {",
      "  print e.code",
      "}",
    ]);

    expect(lines).toEqual(["VN7005"]);
  });
});
