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

/**
 * Stands in for the runtime's `ctx.show` in these tests: the same shape a map
 * or list gets from `print` and `${}`, without pulling `@venn-lang/core` into
 * a plugin package that must not depend on it.
 */
function show(value: unknown): string {
  if (typeof value === "string") return value;
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
    expect(toJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(toJson({ a: 1 }, 0)).toBe('{"a":1}');
  });

  it("degrades instead of throwing on a cycle", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(typeof toJson(cyclic)).toBe("string");
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
    const yaml = toYaml({ name: "Ada", tags: ["a", "b"], nested: { n: 1 } });

    expect(yaml).toBe("name: Ada\ntags:\n  - a\n  - b\nnested:\n  n: 1");
  });

  it("quotes a string that would not read as plain YAML", () => {
    expect(toYaml({ v: "a: b" })).toBe('v: "a: b"');
    expect(toYaml({ v: "" })).toBe('v: ""');
  });

  it("marks an empty list and an empty map", () => {
    expect(toYaml({ xs: [], m: {} })).toBe("xs: []\nm: {}");
  });
});

describe("fmt.csv", () => {
  it("writes a header row and one line per record", () => {
    expect(toCsv(ROWS)).toBe("name,age\nAda,36\nLinus,54");
  });

  it("quotes only the fields that need it, doubling inner quotes", () => {
    const csv = toCsv([{ text: 'say "hi", now', plain: "ok" }]);

    expect(csv).toBe('text,plain\n"say ""hi"", now",ok');
  });

  it("honours a different separator", () => {
    expect(toCsv(ROWS, ";").split("\n")[0]).toBe("name;age");
  });
});

describe("fmt.xml", () => {
  it("turns keys into elements and escapes text", () => {
    expect(toXml({ name: "a & b" }, "user")).toBe("<user>\n  <name>a &amp; b</name>\n</user>");
  });

  it("repeats the tag for each item of a list", () => {
    expect(toXml({ tag: ["x", "y"] }, "root")).toContain("<tag>x</tag>\n  <tag>y</tag>");
  });
});
