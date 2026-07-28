import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readPackageTypes } from "./read-package-types.js";

const roots: string[] = [];

afterAll(async () => {
  for (const dir of roots) await rm(dir, { recursive: true, force: true });
});

/** A tiny installed package, declarations and all, as a real tree on disk. */
async function installed(name: string, declarations: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "venn-dts-"));
  roots.push(root);
  const dir = join(root, "node_modules", name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.d.ts"), declarations, "utf8");
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name, version: "1.0.0", types: "index.d.ts", main: "index.js" }),
    "utf8",
  );
  const from = join(root, "package.json");
  await mkdir(dirname(from), { recursive: true });
  await writeFile(from, JSON.stringify({ name: "alvo", private: true }), "utf8");
  return from;
}

function of(types: { exports: Record<string, unknown> }, name: string): unknown {
  return types.exports[name];
}

/**
 * What an installed package publishes, read through the TypeScript compiler.
 *
 * Through the compiler rather than by parsing `.d.ts` text, and that is the
 * decision the whole thing rests on: a modern package's exported types are
 * built out of generics, conditionals and mapped types, which have no meaning
 * until something resolves them. Parsing gives back the machinery; asking gives
 * back the answer.
 */
describe("the types an installed package publishes", () => {
  it("reads the scalars", async () => {
    const from = await installed(
      "escalares",
      "export declare const nome: string;\nexport declare const idade: number;\nexport declare const certo: boolean;\n",
    );

    const types = readPackageTypes({ package: "escalares", from });

    expect(of(types, "nome")).toEqual({ kind: "prim", name: "string" });
    expect(of(types, "idade")).toEqual({ kind: "prim", name: "number" });
    expect(of(types, "certo")).toEqual({ kind: "prim", name: "bool" });
  });

  it("reads a function, with what it must be given", async () => {
    const from = await installed(
      "chamavel",
      "export declare function somar(a: number, b?: number): number;\n",
    );

    expect(of(readPackageTypes({ package: "chamavel", from }), "somar")).toEqual({
      kind: "fn",
      params: [
        { kind: "prim", name: "number" },
        { kind: "prim", name: "number" },
      ],
      result: { kind: "prim", name: "number" },
      takes: 1,
    });
  });

  it("reads a list and an object", async () => {
    const from = await installed(
      "formas",
      "export declare const nomes: string[];\nexport declare const um: { id: number };\n",
    );
    const types = readPackageTypes({ package: "formas", from });

    expect(of(types, "nomes")).toEqual({ kind: "list", element: { kind: "prim", name: "string" } });
    expect(of(types, "um")).toMatchObject({ kind: "record", open: true });
  });

  /**
   * The point of leaning on the compiler: a conditional type has no meaning
   * until it is resolved, and reading the text would give back the machinery.
   */
  it("reads a generic and a conditional as the answer, not the machinery", async () => {
    const from = await installed(
      "resolvido",
      [
        "type Desembrulha<T> = T extends Promise<infer U> ? U : T;",
        "export declare const pronto: Desembrulha<Promise<string>>;",
        "export declare const lista: Array<number>;",
      ].join("\n"),
    );
    const types = readPackageTypes({ package: "resolvido", from });

    expect(of(types, "pronto")).toEqual({ kind: "prim", name: "string" });
    expect(of(types, "lista")).toEqual({ kind: "list", element: { kind: "prim", name: "number" } });
  });

  /** `string | undefined` is one type here: a string that may not be there. */
  it("folds absence out of a union", async () => {
    const from = await installed("talvez", "export declare const x: string | undefined;\n");

    expect(of(readPackageTypes({ package: "talvez", from }), "x")).toEqual({
      kind: "prim",
      name: "string",
    });
  });

  it("counts how much came across", async () => {
    const from = await installed(
      "medido",
      "export declare const a: string;\nexport declare const b: unknown;\n",
    );

    expect(readPackageTypes({ package: "medido", from }).covered).toEqual({
      total: 2,
      dynamic: 1,
    });
  });

  /** A package with no declarations is not an error, since plenty ship none. */
  it("answers with nothing for a package it cannot find", async () => {
    const from = await installed("existe", "export declare const a: string;\n");

    expect(readPackageTypes({ package: "nao-existe", from }).covered.total).toBe(0);
  });

  /** A type that contains itself must not be followed forever. */
  it("stops at a type that leads back to itself", async () => {
    const from = await installed(
      "ciclico",
      "export interface No { valor: string; proximo: No }\nexport declare const raiz: No;\n",
    );

    expect(readPackageTypes({ package: "ciclico", from }).exports.raiz).toMatchObject({
      kind: "record",
    });
  });
});
