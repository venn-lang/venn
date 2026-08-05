import { describe, expect, it } from "vitest";
import { strayManifestKeys } from "./stray-keys.js";

const WRITTEN = `[package]
name = "shop"

[format]
indent = 2
indeent = 8

[runner]
workers = 4

[env.local]
API = "http://localhost"
`;

const NAMED = '[paths]\n"#api" = "src/api"\n\n[dependencies]\nhttp = "1.0.0"\n';
const KNOWN = '[package]\nname = "shop"\nversion = "1.0.0"\n\n[tooling]\nmanager = "pnpm"\n';
/** What the shipped manifest example taught, from before the key stopped being read. */
const EDITION = '[package]\nname = "demo"\nversion = "1.0.0"\nedition = "2026"\n';

describe("a venn.toml carrying what nothing reads", () => {
  it("reports the table and the key, each where it is written", () => {
    expect(strayManifestKeys(WRITTEN)).toEqual([
      { path: "format.indeent", line: 6 },
      { path: "runner", line: 8 },
    ]);
  });
});

describe("a venn.toml the reader knows through and through", () => {
  // `[paths]`, `[dependencies]` and the rest: every key in them names something.
  it.each([NAMED, KNOWN, EDITION])("says nothing about it", (manifest) => {
    expect(strayManifestKeys(manifest)).toEqual([]);
  });
});
