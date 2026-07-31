import { ALL_CAPABILITIES, createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, defineMatcher, definePlugin } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { checkDocument, checkImports } from "../check/index.js";
import { createMemorySink } from "../eventsink/index.js";
import { buildRegistry } from "../registry/index.js";
import { createRunner } from "../run/index.js";
import { readImports } from "./read-imports.js";

/** A plugin with one of everything a package can publish. */
const PLUGIN = definePlugin({
  name: "@t/kit",
  version: "0",
  namespace: "kit",
  actions: [
    defineAction({
      name: "shout",
      run: (_ctx, input) => String(input.args[0] ?? "").toUpperCase(),
    }),
  ],
  matchers: [
    defineMatcher({
      name: "louder",
      test: ({ subject, args }) => subject === args[0],
      message: () => "not louder",
    }),
  ],
  decorators: [{ name: "twice", expand: (target) => target }],
  typeDefs: { Voice: t.record({ pitch: t.number }) },
});

const registry = buildRegistry({ plugins: [PLUGIN], caps: ALL_CAPABILITIES });

/** What the checker says about a source, code and all. */
function said(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkDocument({ document: ast, registry, fragments: new Set() }).map(
    (problem) => `${problem.code} ${problem.title}`,
  );
}

function imported(source: string) {
  return readImports(parse(source).ast, registry);
}

async function ran(source: string): Promise<string[]> {
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
  const runner = createRunner({
    host: createTestHost(),
    plugins: [PLUGIN, printer],
    sink: createMemorySink(),
  });
  await runner.script(parse(source).ast);
  return out;
}

describe("what an import of a package brings", () => {
  it("brings the namespace under its own name", () => {
    const found = imported('import { kit } from "@t/kit"');

    expect([...found.namespaces]).toEqual([["kit", "kit"]]);
  });

  it("brings it under another name when one is written", () => {
    const found = imported('import { kit as tools } from "@t/kit"');

    expect([...found.namespaces]).toEqual([["tools", "kit"]]);
  });

  it("brings a matcher by its own name", () => {
    expect([...imported('import { louder } from "@t/kit"').matchers]).toEqual([
      ["louder", "louder"],
    ]);
  });

  it("brings a decorator by its own name", () => {
    expect([...imported('import { twice } from "@t/kit"').decos]).toEqual([["twice", "twice"]]);
  });

  it("brings a type by its own name", () => {
    expect([...imported('import { Voice } from "@t/kit"').types]).toEqual([["Voice", "kit.Voice"]]);
  });

  it("brings the namespace for a wildcard, since a plugin is one bag", () => {
    const found = imported('import * as everything from "@t/kit"');

    expect([...found.namespaces]).toEqual([["everything", "kit"]]);
  });

  it("keeps what a package does not publish, to be reported", () => {
    const found = imported('import { nope } from "@t/kit"');

    expect(found.unknown).toEqual([{ pkg: "@t/kit", name: "nope", note: undefined }]);
  });

  /** The everyday mistake, and the one the note has to answer. */
  it("says a verb is not a value, and what to write instead", () => {
    const found = imported('import { shout } from "@t/kit"');

    expect(found.unknown[0]?.note).toContain("import `{ kit }` and write `kit.shout`");
  });
});

describe("what the checker refuses", () => {
  it("refuses a namespace nobody imported", () => {
    expect(said('flow "f" { step "s" { kit.shout "hi" } }')[0]).toContain(
      'VN2007 "kit" is not imported',
    );
  });

  it("refuses it inside an expression, where it hid before", () => {
    expect(said('print kit.shout("hi")')[0]).toContain('VN2007 "kit" is not imported');
  });

  it("refuses a matcher nobody imported", () => {
    const source = 'import { kit } from "@t/kit"\nflow "f" { step "s" { expect 1 louder 1 } }';

    expect(said(source)[0]).toContain('VN2007 "louder" is not imported');
  });

  it("refuses the namespace's own name once it was renamed", () => {
    const source =
      'import { kit as tools } from "@t/kit"\nflow "f" { step "s" { kit.shout "hi" } }';

    expect(said(source)[0]).toContain('VN2007 "kit" is not imported');
  });

  it("says `use` is gone, and what to write", () => {
    const said_ = said('use "@t/kit"\nflow "f" { step "s" { kit.shout "hi" } }');

    expect(said_[0]).toContain("VN5001 `use` was removed");
  });

  it("leaves a name the file binds alone", () => {
    const source = 'let kit = { shout: fn (x) => x }\nprint kit.shout("hi")';

    expect(said(source)).toEqual([]);
  });

  it("leaves a name bound by a pattern alone, too", () => {
    const source = "const { kit } = { kit: { shout: 1 } }\nprint kit.shout";

    expect(said(source)).toEqual([]);
  });

  it("leaves a loop variable alone", () => {
    const source = "forEach kit in [1] {\n  print kit.len\n}";

    expect(said(source)).toEqual([]);
  });

  it("leaves a parameter alone", () => {
    const source = "fn take(kit) => kit.shout()\nprint take({ shout: fn () => 1 })";

    expect(said(source)).toEqual([]);
  });

  it("accepts everything once it is all imported", () => {
    const source = `import { kit, louder } from "@t/kit"
flow "f" {
  step "s" {
    kit.shout "hi"
    expect 1 louder 1
  }
}`;

    expect(said(source)).toEqual([]);
  });
});

describe("what a package does not publish", () => {
  it("says so without a note when the name is nothing at all", () => {
    expect(imported('import { nowhere } from "@t/kit"').unknown[0]?.note).toBeUndefined();
  });

  it("is reported where it is written", () => {
    const { ast } = parse('import { nope } from "@t/kit"');
    const problems = checkImports({
      document: ast,
      uri: "memory://inline.vn",
      graph: { modules: new Map(), resolve: (_base, spec) => spec },
      registry,
    });

    expect(problems[0]?.title).toContain('"@t/kit" does not publish nope');
  });

  /** Without a registry there are no packages, which is a Worker's whole world. */
  it("says nothing when no plugin was loaded at all", () => {
    const { ast } = parse('import { nope } from "@t/kit"');
    const problems = checkImports({
      document: ast,
      uri: "memory://inline.vn",
      graph: { modules: new Map(), resolve: (_base, spec) => spec },
    });

    expect(problems).toEqual([]);
  });
});

describe("what runs", () => {
  it("runs a verb reached through the name it was imported as", async () => {
    const source = 'import { kit as tools } from "@t/kit"\nio.print(tools.shout("hi"))';

    expect(await ran(source)).toEqual(["HI"]);
  });

  it("runs one reached through its own name", async () => {
    expect(await ran('import { kit } from "@t/kit"\nio.print(kit.shout("hi"))')).toEqual(["HI"]);
  });

  it("runs a verb inside an expression, where the value has to be there", async () => {
    const source = 'import { kit } from "@t/kit"\nio.print("said: ${kit.shout(\\"hi\\")}")';

    expect(await ran(source)).toEqual(["said: HI"]);
  });
});
