import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { fixtureFromFile } from "../testing/lsp-fixture.js";

const roots: string[] = [];

afterAll(async () => {
  for (const dir of roots) await rm(dir, { recursive: true, force: true });
});

/**
 * A project whose install already derived a package's types.
 *
 * Written by hand rather than by running an install: what is being tested is
 * that the editor *reads* `target/types/`, not that something can write it.
 */
async function projectWithDerived(source: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "venn-lsp-pkg-"));
  roots.push(root);
  await writeFile(join(root, "venn.toml"), '[package]\nname = "app"\n', "utf8");
  await mkdir(join(root, "target", "types"), { recursive: true });
  await writeFile(
    join(root, "target", "types", "zod.json"),
    JSON.stringify({
      package: "zod",
      exports: {
        z: {
          kind: "record",
          open: true,
          fields: {
            string: {
              kind: "fn",
              params: [],
              result: {
                kind: "record",
                open: true,
                fields: {
                  parse: {
                    kind: "fn",
                    params: [{ kind: "dynamic" }],
                    result: { kind: "prim", name: "string" },
                    takes: 1,
                  },
                },
              },
              takes: 0,
            },
          },
        },
      },
      covered: { total: 1, dynamic: 0 },
    }),
    "utf8",
  );
  const file = join(root, "main.vn");
  await writeFile(file, source, "utf8");
  return file;
}

async function problems(source: string): Promise<string[]> {
  const { services, document } = await fixtureFromFile(await projectWithDerived(source));
  return services.types.of(document).problems.map((problem) => problem.title);
}

/**
 * What the editor knows about a name that came from an installed package.
 *
 * The types are derived at install and written into `target/types/`, because
 * reading a package's declarations through the TypeScript compiler takes about
 * a second and cannot happen on a keystroke. The editor reads them from there,
 * so it agrees with `venn check` about the same line.
 */
describe("the type of a name imported from a package", () => {
  it("is the one the package published", async () => {
    const source = 'import { z } from "zod"\nconst certo: string = z.string().parse(1)\n';

    expect(await problems(source)).toEqual([]);
  });

  it("catches a result used as the wrong type", async () => {
    const source = 'import { z } from "zod"\nconst errado: number = z.string().parse(1)\n';
    const found = await problems(source);

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("expected number, found string");
  });

  /** Nothing derived means nothing known, which is the truth, not a failure. */
  it("says nothing about a package whose types were never derived", async () => {
    const source = 'import { outra } from "nao-derivada"\nconst x: number = outra()\n';

    expect(await problems(source)).toEqual([]);
  });
});
