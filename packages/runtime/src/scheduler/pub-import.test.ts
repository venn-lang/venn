import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner, resolveImports } from "../run/index.js";

const ENTRY = "/app/main.vn";

function io(files: Record<string, string>) {
  return {
    read: (uri: string) =>
      uri in files ? Promise.resolve(files[uri] as string) : Promise.reject(new Error("nope")),
    resolve: (_base: string, spec: string) =>
      spec.startsWith(".") ? `/app/${spec.replace("./", "")}` : spec,
  };
}

/** Run the entry file, with the neighbours it imports, and collect what it printed. */
async function ran(files: Record<string, string>): Promise<string[]> {
  const out: string[] = [];
  const printer = definePlugin({
    name: "@t/io",
    version: "0",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => void out.push(input.args.map(String).join(" ")),
      }),
    ],
  });
  const document = parse(files[ENTRY] as string, { uri: ENTRY }).ast;
  const graphIo = io(files);
  const found = await resolveImports({ document, uri: ENTRY, io: graphIo });
  const runner = createRunner({
    host: createTestHost(),
    plugins: [printer],
    sink: createMemorySink(),
    uri: ENTRY,
    modules: { modules: found.modules, resolve: graphIo.resolve },
  });
  await runner.script(document);
  return out;
}

const CART = "pub const rate = 2\npub fn total(n) => n * 10";

/**
 * `pub import`: a file handing on a name it brought in from somewhere else.
 *
 * The grammar has parsed it since imports were written, and nothing read the
 * flag. A file that trusted it published nothing, and the failure arrived
 * wherever the name was used, as a value that was absent until something called
 * it.
 *
 * It is what lets a folder have a face: one file naming what the folder
 * publishes, so a caller never learns its insides.
 */
describe("a name handed on with pub import", () => {
  it("is published by the file that handed it on", async () => {
    const printed = await ran({
      "/app/cart.vn": CART,
      "/app/mod.vn": 'pub import { total } from "./cart.vn"',
      [ENTRY]: 'import { total } from "./mod.vn"\nio.print(total(3))',
    });

    expect(printed).toEqual(["30"]);
  });

  it("keeps the name the handing file gave it", async () => {
    const printed = await ran({
      "/app/cart.vn": CART,
      "/app/mod.vn": 'pub import { total as sum } from "./cart.vn"',
      [ENTRY]: 'import { sum } from "./mod.vn"\nio.print(sum(2))',
    });

    expect(printed).toEqual(["20"]);
  });

  /** A folder inside a folder: the nested namespace, by the same mechanism. */
  it("hands on a whole module as a namespace", async () => {
    const printed = await ran({
      "/app/cart.vn": CART,
      "/app/mod.vn": 'pub import * as cart from "./cart.vn"',
      [ENTRY]: 'import * as shop from "./mod.vn"\nio.print(shop.cart.rate)',
    });

    expect(printed).toEqual(["2"]);
  });

  it("is seen on a namespace that gathers the whole module", async () => {
    const printed = await ran({
      "/app/cart.vn": CART,
      "/app/mod.vn": 'pub import { rate } from "./cart.vn"\npub const tag = "shop"',
      [ENTRY]: 'import * as shop from "./mod.vn"\nio.print(shop.rate)\nio.print(shop.tag)',
    });

    expect(printed).toEqual(["2", "shop"]);
  });

  it("travels further than one hop", async () => {
    const printed = await ran({
      "/app/inner.vn": 'pub const deep = "found"',
      "/app/mid.vn": 'pub import { deep } from "./inner.vn"',
      "/app/outer.vn": 'pub import { deep } from "./mid.vn"',
      [ENTRY]: 'import { deep } from "./outer.vn"\nio.print(deep)',
    });

    expect(printed).toEqual(["found"]);
  });

  /** Handing on is publishing, so what is not handed on is still private. */
  it("does not publish an import that was not marked", async () => {
    const printed = await ran({
      "/app/cart.vn": CART,
      "/app/mod.vn": 'import { rate } from "./cart.vn"\npub const tag = "shop"',
      [ENTRY]: 'import * as shop from "./mod.vn"\nio.print(shop.rate)',
    });

    expect(printed).toEqual(["null"]);
  });
});
