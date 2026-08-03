import { ALL_CAPABILITIES } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { buildRegistry, checkDocument } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";

const IMPORTS = [
  'import { http, header } from "venn/http"',
  'import { json } from "venn/json"',
  'import { auth } from "venn/auth"',
  'import { io } from "venn/io"',
].join("\n");

/** What the checker refuses in one line of Venn, by code. Hints are not refusals. */
function checked(line: string): string[] {
  const { ast, problems } = parse(`${IMPORTS}\n${line}`);
  expect(problems).toEqual([]);
  const registry = buildRegistry({ plugins: allPlugins, caps: ALL_CAPABILITIES });
  return checkDocument({ document: ast, registry, fragments: new Set() })
    .filter((one) => one.severity === "error")
    .map((one) => one.code);
}

/**
 * The shape of a call was the one thing nothing looked at, which is why three
 * verbs could disagree with their own declarations for a release: an argument
 * declared and never read, one read and never declared, and two read in the
 * order they were not declared in.
 */
describe("a call with more positional arguments than the verb takes", () => {
  it("is refused where it is written", () => {
    expect(checked('const a = json.parse("{}", "extra", 1, 2, 3)')).toEqual(["VN3002"]);
    expect(checked('const c = auth.hmac("a", "b", "c", "d")')).toEqual(["VN3002"]);
  });
});

describe("a call with fewer arguments than the verb needs", () => {
  it("is refused where it is written", () => {
    expect(checked("const b = http.get()")).toEqual(["VN3002"]);
  });

  it("counts a matcher's clause the same way", () => {
    const written = 'flow "f" {\n  const res = http.get "http://x"\n  expect res header\n}';
    expect(checked(written)).toEqual(["VN3002"]);
  });
});

describe("a call the verb does accept", () => {
  it("is left alone, whichever spelling wrote it", () => {
    expect(checked('const a = json.parse("{}")')).toEqual([]);
    expect(checked('const b = http.get "http://x" { query: { q: "1" } }')).toEqual([]);
    expect(checked('const c = http.get("http://x", { query: { q: "1" } })')).toEqual([]);
    expect(checked('const d = auth.hmac("secret", "payload")')).toEqual([]);
  });

  /** A variadic verb takes whatever it is handed, so there is nothing to count. */
  it("is left alone when the verb takes the rest", () => {
    expect(checked('io.write "a" "b" "c"')).toEqual([]);
  });
});
