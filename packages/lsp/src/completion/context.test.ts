import { describe, expect, it } from "vitest";
import type { CompletionContext } from "./completion.types.js";
import { contextAt } from "./context.js";

/** Most contexts are decided by the current line alone; `before` defaults to it. */
function at(prefix: string, line = prefix, before = prefix): CompletionContext {
  return contextAt({ prefix, line, before });
}

describe("completion context", () => {
  it("recognises a half-typed package name, not only a complete one", () => {
    const half = 'import { http } from "@mant';
    const empty = 'import { http } from "';

    expect(at(half)).toEqual({ kind: "package", from: half.length - "@mant".length });
    expect(at(empty)).toEqual({ kind: "package", from: empty.length });
  });

  it("reads the module path a named import comes from", () => {
    const line = 'import {  } from "./shared/auth.vn"';

    expect(at("import { ", line)).toEqual({
      kind: "importName",
      from: 9,
      path: "./shared/auth.vn",
    });
  });

  it("keeps completing the name after a comma inside the braces", () => {
    const line = 'import { login, sig } from "./a.vn"';

    expect(at("import { login, sig", line)).toEqual({
      kind: "importName",
      from: 16,
      path: "./a.vn",
    });
  });

  it("classifies a module path, which also looks like namespace.action", () => {
    expect(at('  from "#sha', '  from "#sha"')).toEqual({
      kind: "modulePath",
      from: 8,
      partial: "#sha",
    });
    expect(at('  from "./shared/auth.vn', '  from "./shared/auth.vn"')).toEqual({
      kind: "modulePath",
      from: 8,
      partial: "./shared/auth.vn",
    });
  });

  it("still classifies actions, annotations, fragments and matchers", () => {
    expect(at("  http.")).toEqual({ kind: "action", receiver: "http", from: 7 });
    expect(at("  @ret")).toEqual({ kind: "annotation", from: 3 });
    expect(at("  run lo")).toEqual({ kind: "fragment", from: 6 });
    expect(at("  expect res.status ")).toEqual({ kind: "matcher", from: 20 });
  });

  it("falls back to the statement context at the start of a line", () => {
    expect(at("  ht")).toEqual({ kind: "statement", from: 2 });
  });
});

describe("options map context", () => {
  const call = 'flow "f" {\n  step "s" {\n    http.post "/token" {\n';

  it("knows which call owns the braces the cursor is in", () => {
    expect(at("      ", "      ", `${call}      `)).toEqual({
      kind: "optionKey",
      target: "http.post",
      from: 6,
    });
  });

  it("keeps the owner while a key is half-typed", () => {
    expect(at("      bo", "      bo", `${call}      bo`)).toEqual({
      kind: "optionKey",
      target: "http.post",
      from: 6,
    });
  });

  it("offers nothing inside a nested map, whose shape it cannot know", () => {
    const nested = `${call}      body: {\n        `;

    expect(at("        ", "        ", nested).kind).toBe("statement");
  });

  it("does not mistake a step or flow block for an options map", () => {
    expect(at("    ", "    ", 'flow "f" {\n  step "s" {\n    ').kind).toBe("statement");
  });

  it("finds the owner when the call is bound with let", () => {
    const bound = 'flow "f" {\n  step "s" {\n    const a = http.get "/x" {\n      ';

    expect(at("      ", "      ", bound)).toEqual({
      kind: "optionKey",
      target: "http.get",
      from: 6,
    });
  });
});

// The receiver here is not a name, so `action` cannot classify it. `1234.567.`
// is the case that matters: a bare number takes methods without parentheses.
describe("a dot with no nameable receiver", () => {
  it("classifies a literal, a bracket and a quote as a member read", () => {
    expect(at("let n = 1234.567.")).toEqual({ kind: "member", from: 17 });
    expect(at("let n = (1.5).")).toEqual({ kind: "member", from: 14 });
    expect(at("let n = [1, 2].")).toEqual({ kind: "member", from: 15 });
    expect(at('let n = "ab".')).toEqual({ kind: "member", from: 13 });
  });

  it("still sends a named receiver to the action path", () => {
    expect(at("let n = xs.")).toEqual({ kind: "action", receiver: "xs", from: 11 });
  });
});
