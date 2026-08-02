import { describe, expect, it } from "vitest";
import type { Document } from "../../generated/ast.js";
import { parse } from "../../parse/index.js";
import { readDecorations } from "../decorations.js";
import { expand } from "../expand.js";
import { readMeta } from "../node-meta.js";

const NOTHING = { get: () => undefined, names: () => [] };

/** The files an import graph reached, as expansion receives them. */
function graph(files: Record<string, string>): Map<string, Document> {
  const found = new Map<string, Document>();
  for (const [uri, source] of Object.entries(files)) found.set(uri, parsed(source, uri));
  return found;
}

function parsed(source: string, uri: string): Document {
  const { ast, problems } = parse(source, { uri });
  expect(problems).toEqual([]);
  return ast;
}

/** One declaration of a module the graph holds, by position. */
function declOf(modules: Map<string, Document>, uri: string, at: number): object {
  return (modules.get(uri) as Document).decls[at] as object;
}

const LOUD = [
  'deco loud(target: Fn) { target.meta "loud" true }',
  "@loud",
  "pub fn label(who) => who",
];

/**
 * A decorator crosses a file by not having to. The `deco` and the declaration it
 * sits on are written together, and the only reason the decoration used to
 * vanish was that expansion looked at one file and the program was made of two.
 */
describe("a decorator written in an imported file still decorates", () => {
  it("runs on the declaration it sits on, in the file that wrote both", () => {
    const modules = graph({ "/lib.vn": LOUD.join("\n") });
    const use = parsed('import { label } from "./lib.vn"', "/use.vn");

    const { problems } = expand({ document: use, decorators: NOTHING, uri: "/use.vn", modules });

    expect(problems).toEqual([]);
    expect(readMeta(declOf(modules, "/lib.vn", 1), "loud")).toBe(true);
  });

  it("runs on a private declaration the exported one calls", () => {
    const lib = [
      'deco loud(target: Fn) { target.meta "loud" true }',
      "@loud",
      "fn shout(who) => who",
      "pub fn label(who) => shout(who)",
    ];
    const modules = graph({ "/lib.vn": lib.join("\n") });
    const use = parsed('import { label } from "./lib.vn"', "/use.vn");

    expand({ document: use, decorators: NOTHING, uri: "/use.vn", modules });

    expect(readMeta(declOf(modules, "/lib.vn", 1), "loud")).toBe(true);
  });

  it("reports a fault in an imported file at that file, not at the one being run", () => {
    const modules = graph({
      "/lib.vn": [
        "deco loud(target: Fn) { target.wobble 1 }",
        "@loud",
        "pub fn label(who) => who",
      ].join("\n"),
    });
    const use = parsed('import { label } from "./lib.vn"', "/use.vn");

    const { problems } = expand({ document: use, decorators: NOTHING, uri: "/use.vn", modules });

    expect(problems.map((one) => one.code)).toEqual(["VN2017"]);
    expect(problems[0]?.span.uri).toBe("/lib.vn");
  });

  it("still expands the file being run", () => {
    const modules = graph({ "/lib.vn": 'pub deco quiet(target: Fn) { target.meta "quiet" true }' });
    const own = ['deco loud(target: Fn) { target.meta "loud" true }', "@loud", "fn here(x) => x"];
    const use = parsed(own.join("\n"), "/use.vn");

    expand({ document: use, decorators: NOTHING, uri: "/use.vn", modules });

    expect(readMeta(use.decls[1] as object, "loud")).toBe(true);
  });

  /** A `wrap` appends, so a file expanded twice would wrap its own body twice. */
  it("expands the file being run once, however the graph names it", () => {
    const wrapping = [
      "deco once(target: Fn) { target.wrap(fn (call, args) => call(args)) }",
      "@once",
      "fn here(x) => x",
    ];
    const use = parsed(wrapping.join("\n"), "/use.vn");

    expand({
      document: use,
      decorators: NOTHING,
      uri: "/use.vn",
      modules: new Map([["/use.vn", use]]),
    });

    expect(readDecorations(use.decls[1] as object)?.wrap).toHaveLength(1);
  });
});
