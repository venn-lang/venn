import { describe, expect, it } from "vitest";
import { toCsv } from "./render/csv.js";
import { toJson } from "./render/json.js";
import { toTable } from "./render/table.js";
import { toXml } from "./render/xml.js";
import { toYaml } from "./render/yaml.js";

const ROWS = [
  { name: "Ada", age: 36 },
  { name: "Linus", age: 54 },
];

/** `250ms`, as the interpreter hands one to a plugin. */
const TOOK = { kind: "duration", ms: 250 };

/** `regex(r"a-z", "i")` and a running task, the same way. */
const PATTERN = { kind: "regex", source: "a-z", flags: "i", compiled: /a-z/i };
const TASK = { [Symbol("venn.task")]: true, promise: Promise.resolve(1), settled: false };

/**
 * Stands in for the runtime's `ctx.show`, and deliberately does not copy it.
 *
 * There used to be a hand copy of `@venn-lang/core`'s `displayValue` here, put
 * in so a plugin package would not have to depend on the compiler. It had no
 * unit branch, so it wrote `250ms` as `{ kind: "duration", ms: 250 }`, and the
 * test named "writes a nested cell the way the language writes it" passed
 * against a fake that disagreed with production about exactly the values it
 * was checking.
 *
 * This one answers `~250ms~`, which the language never writes. Nothing here
 * asserts that text: the assertions ask for `show(value)`, so what is held is
 * that every renderer ASKS rather than deciding for itself. A renderer that
 * walked into the value cannot accidentally look right.
 */
function show(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return written(value);
  if ("ms" in value) return `~${value.ms}ms~`;
  if ("compiled" in value) return "~regex~";
  if ("promise" in value) return "~task~";
  return written(value);
}

function written(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(written).join(", ")}]`;
  if (typeof value === "object") return writtenMap(value as Record<string, unknown>);
  return String(value);
}

function writtenMap(value: Record<string, unknown>): string {
  const parts = Object.entries(value).map(([key, held]) => `${key}: ${written(held)}`);
  return parts.length === 0 ? "{}" : `{ ${parts.join(", ")} }`;
}

describe("fmt.json", () => {
  it("indents by two by default and folds to one line at zero", () => {
    expect(toJson({ a: 1 }, show)).toBe('{\n  "a": 1\n}');
    expect(toJson({ a: 1 }, show, 0)).toBe('{"a":1}');
  });

  it("degrades instead of throwing on a cycle", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(typeof toJson(cyclic, show)).toBe("string");
  });
});

describe("fmt.table", () => {
  it("aligns every column to its widest cell", () => {
    const lines = toTable(ROWS, show).split("\n");

    expect(lines[0]).toBe("name  │ age");
    expect(lines[2]).toBe("Ada   │ 36 ");
    expect(lines).toHaveLength(4);
  });

  it("keeps rows lined up when one lacks a field", () => {
    const table = toTable([{ a: 1, b: 2 }, { a: 3 }], show);

    expect(table).toContain("a │ b");
    expect(table.split("\n")).toHaveLength(4);
  });

  it("says so when there is nothing to show", () => {
    expect(toTable([], show)).toBe("(no rows)");
  });

  it("writes a nested cell the way the language writes it, not as JSON", () => {
    const table = toTable([{ name: "ada", marks: { homework: 95, final: 92 } }], show);

    expect(table).toContain("{ homework: 95, final: 92 }");
    expect(table).not.toContain('{"homework":95,"final":92}');
  });
});

describe("fmt.yaml", () => {
  it("puts scalars on the key's line and opens a block for structure", () => {
    const yaml = toYaml({ name: "Ada", tags: ["a", "b"], nested: { n: 1 } }, show);

    expect(yaml).toBe("name: Ada\ntags:\n  - a\n  - b\nnested:\n  n: 1");
  });

  it("quotes a string that would not read as plain YAML", () => {
    expect(toYaml({ v: "a: b" }, show)).toBe('v: "a: b"');
    expect(toYaml({ v: "" }, show)).toBe('v: ""');
  });

  it("marks an empty list and an empty map", () => {
    expect(toYaml({ xs: [], m: {} }, show)).toBe("xs: []\nm: {}");
  });
});

describe("fmt.csv", () => {
  it("writes a header row and one line per record", () => {
    expect(toCsv(ROWS, show)).toBe("name,age\nAda,36\nLinus,54");
  });

  it("quotes only the fields that need it, doubling inner quotes", () => {
    const csv = toCsv([{ text: 'say "hi", now', plain: "ok" }], show);

    expect(csv).toBe('text,plain\n"say ""hi"", now",ok');
  });

  it("honours a different separator", () => {
    expect(toCsv(ROWS, show, ";").split("\n")[0]).toBe("name;age");
  });
});

describe("fmt.xml", () => {
  it("turns keys into elements and escapes text", () => {
    const xml = toXml({ value: { name: "a & b" }, show, tag: "user" });

    expect(xml).toBe("<user>\n  <name>a &amp; b</name>\n</user>");
  });

  it("repeats the tag for each item of a list", () => {
    const xml = toXml({ value: { tag: ["x", "y"] }, show });

    expect(xml).toContain("<tag>x</tag>\n  <tag>y</tag>");
  });
});

/**
 * The one thing epic #288 is about: `250ms` is a duration to the language and a
 * two-key map to the host, and four of these five formats used to write the
 * map. They are held to `show` rather than to a literal `250ms`, so this stays
 * true whatever the language decides a duration looks like.
 */
describe("every format writes a unit the way the language writes it", () => {
  const rows = [{ name: "a", took: TOOK }];

  it("keeps the envelope out of a table cell", () => {
    expect(toTable(rows, show)).toContain(show(TOOK));
  });

  it("keeps the envelope out of a CSV field", () => {
    expect(toCsv(rows, show)).toBe(`name,took\na,${show(TOOK)}`);
  });

  it("keeps the envelope out of a YAML scalar", () => {
    expect(toYaml({ took: TOOK }, show)).toBe(`took: ${show(TOOK)}`);
  });

  it("keeps the envelope out of an XML element", () => {
    expect(toXml({ value: { took: TOOK }, show })).toBe(
      `<root>\n  <took>${show(TOOK)}</took>\n</root>`,
    );
  });

  it("keeps the envelope out of a JSON value", () => {
    expect(toJson({ took: TOOK }, show, 0)).toBe(`{"took":"${show(TOOK)}"}`);
  });

  it("leaves an ordinary map that merely spells kind alone", () => {
    const union = { kind: "size", label: "x" };

    expect(toYaml({ box: union }, show)).toBe("box:\n  kind: size\n  label: x");
    expect(toJson({ box: union }, show, 0)).toBe('{"box":{"kind":"size","label":"x"}}');
  });
});

/**
 * The same question asked of the kinds that are not units.
 *
 * Gating on "is this a unit literal" answered for four of the language's
 * fourteen kinds, so yaml, xml and json still walked into a regex and a task
 * and wrote `compiled: {}` and `promise: {}`, a `RegExp` and a `Promise`
 * serialising to nothing at all. The output lost the value and gained keys that
 * mean nothing, which is the envelope this epic set out to remove.
 */
describe("every format writes a regex and a task the way the language writes it", () => {
  it.each([
    ["a regex", PATTERN as unknown],
    ["a task", TASK as unknown],
  ])("keeps the internals of %s out of every surface", (_what, value) => {
    expect(toTable([{ v: value }], show)).toContain(show(value));
    expect(toCsv([{ v: value }], show)).toBe(`v\n${show(value)}`);
    expect(toYaml({ v: value }, show)).toBe(`v: ${show(value)}`);
    expect(toXml({ value: { v: value }, show })).toBe(`<root>\n  <v>${show(value)}</v>\n</root>`);
    expect(toJson({ v: value }, show, 0)).toBe(`{"v":"${show(value)}"}`);
  });
});
