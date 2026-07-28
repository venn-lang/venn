import { checkTypes, parse, showType, type Type } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { createTypeCatalog } from "./create-type-catalog.js";

/** A plugin shaped like the real one: a handle, a handler, and a published type. */
const server = definePlugin({
  name: "@t/server",
  version: "0",
  namespace: "srv",
  typeDefs: {
    Request: t.record({ method: t.string, url: t.string, headers: t.map(t.string) }),
    Server: t.opaque("srv.Server"),
  },
  actions: [
    defineAction({
      name: "serve",
      signature: t.fn([t.record({ port: t.number }, { optional: ["port"] })], t.ref("srv.Server")),
      run: () => undefined,
    }),
    defineAction({
      name: "on",
      signature: t.fn(
        [t.ref("srv.Server"), t.callback([t.ref("srv.Request")], t.dynamic, 1)],
        t.void,
      ),
      run: () => undefined,
    }),
    defineAction({ name: "quiet", run: () => undefined }),
  ],
});

const catalog = createTypeCatalog([server]);

function typeOf(source: string, name: string, kind: string): string | undefined {
  const checked = checkTypes(parse(source).ast, { catalog });
  for (const [node, type] of checked.types) {
    const decl = node as { name?: string; $type?: string };
    if (decl.name === name && decl.$type === kind) return showType(type as Type);
  }
  return undefined;
}

describe("createTypeCatalog", () => {
  it("gives a verb's result the type its plugin published", () => {
    const source = "const api = srv.serve { port: 0 }";

    expect(typeOf(source, "api", "LetStmt")).toBe("srv.Server");
  });

  // The point of the whole exercise: nobody wrote a type, and `req` is a request.
  it("types a handler's parameter from the verb that takes it", () => {
    const source = ["const api = srv.serve { port: 0 }", "srv.on api req => req"].join("\n");

    const type = typeOf(source, "req", "Param");
    expect(type).toContain("method: string");
    expect(type).toContain("url: string");
  });

  it("types a binding by the verb that opened it", () => {
    const source = "const api = srv.serve { port: 0 }";

    expect(typeOf(source, "api", "LetStmt")).toBe("srv.Server");
  });

  // A plugin that says nothing about types is still a working plugin.
  it("leaves a verb with no signature dynamic", () => {
    expect(typeOf('const out = srv.quiet "x" { a: 1 }', "out", "LetStmt")).toBe("dynamic");
  });

  it("answers only for what was published", () => {
    expect(catalog.typeOf("srv.Request")).toBeDefined();
    expect(catalog.typeOf("srv.Nothing")).toBeUndefined();
    expect(catalog.signatureOf("srv.on")).toBeDefined();
    expect(catalog.signatureOf("srv.quiet")).toBeUndefined();
  });

  /** Inference writes into what it is handed; two copies would drift apart. */
  it("hands out the same type object every time", () => {
    expect(catalog.typeOf("srv.Request")).toBe(catalog.typeOf("srv.Request"));
  });
});
