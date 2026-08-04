import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { checkDocument } from "./check-document.js";

function said(source: string): string[] {
  const { ast } = parse(source);
  const registry = buildRegistry({ plugins: [], caps: [] });
  return checkDocument({ document: ast, registry, fragments: new Set() }).map(
    (problem) => `${problem.code} ${problem.title}`,
  );
}

const NOTHING = "has no branches, so there is nothing for it to run.";

describe("a concurrency block with nothing in it", () => {
  it("is reported for a race, which could never settle", () => {
    expect(said('flow "F" {\n  race { }\n}')).toEqual([`VN4001 This race ${NOTHING}`]);
  });

  it("is reported for a parallel, which is half-written the same way", () => {
    expect(said('flow "F" {\n  parallel { }\n}')).toEqual([`VN4001 This parallel ${NOTHING}`]);
  });

  it("leaves a block with branches in it alone", () => {
    expect(said('flow "F" {\n  race {\n    step "a" { log "a" }\n  }\n}')).toEqual([]);
  });
});
