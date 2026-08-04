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

const flow = (line: string): string => `flow "F" {\n  ${line}\n}`;

const A = '{ step "a" { log "a" } }';

const REFUSED: readonly (readonly [string, string])[] = [
  [
    `parallel { onErrr: "cancel" } ${A}`,
    'VN3001 "onErrr" is not an option here. Did you mean "onError"?',
  ],
  [
    `parallel { mode: "whatever" } ${A}`,
    'VN3001 "mode" is not an option here. Accepted: concurrency, onError.',
  ],
  [
    "forEach n in [1] { concurrancy: 3 } { log n }",
    'VN3001 "concurrancy" is not an option here. Did you mean "concurrency"?',
  ],
  [
    `parallel { onError: "collct" } ${A}`,
    'VN3010 "collct" is not a onError this understands. Accepted: cancel, collect.',
  ],
  [
    'forEach n in [1] { concurrency: "3" } { log n }',
    "VN3010 concurrency needs a number, and this is a string.",
  ],
];

describe("an option a concurrency block does not accept", () => {
  it.each(REFUSED)("refuses %s", (line, problem) => {
    expect(said(flow(line))).toEqual([problem]);
  });
});

const ACCEPTED = [
  `parallel { concurrency: 2, "onError": "collect" } ${A}`,
  `race { timeout: 10s } ${A}`,
  // What the reader could not know is left to the runtime rather than guessed
  // at: a name is not a mistake.
  "forEach n in [1] { concurrency: pool } { log n }",
];

describe("an option a concurrency block does accept", () => {
  it.each(ACCEPTED)("passes %s", (line) => {
    expect(said(`flow "F" {\n  const pool = 2\n  ${line}\n}`)).toEqual([]);
  });
});
