import type { AstNode } from "langium";
import { describe, expect, it } from "vitest";
import { evaluate, invoke } from "../../expr/index.js";
import type { Declaration, Document, LetStmt } from "../../generated/ast.js";
import { parse } from "../../parse/index.js";
import { ProblemError } from "../../problem/index.js";
import { readDecorations } from "../decorations.js";
import { readMeta } from "../node-meta.js";
import type { TargetHandle } from "./handle.types.js";
import { makeHandle } from "./make-handle.js";
import { targetKindOf } from "./target-kind-of.js";

/** Nothing is bound yet, which is exactly the scope expansion evaluates in. */
const NOTHING = { lookup: () => undefined };

function firstDecl(source: string): { doc: Document; node: Declaration } {
  const doc = parse(source).ast;
  return { doc, node: doc.decls[0] as Declaration };
}

function handleOf(source: string): { doc: Document; node: AstNode; handle: TargetHandle } {
  const { doc, node } = firstDecl(source);
  return { doc, node, handle: makeHandle({ node, kind: targetKindOf(node) }) };
}

const call = (handle: TargetHandle, verb: string, ...args: unknown[]): unknown =>
  invoke(handle[verb], args);

describe("what a handle knows about its target", () => {
  it("answers with the declared name, and with a title where that is the name", () => {
    expect(handleOf("fn greet() => 1").handle.name).toBe("greet");
    expect(handleOf('flow "checkout" { }').handle.name).toBe("checkout");
    expect(handleOf('flow "checkout" { }').handle.title).toBe("checkout");
  });

  it("reads a function's parameters, and adds, drops and renames", () => {
    const { handle } = handleOf("fn greet(who) => 1");

    expect(handle.params).toEqual(["who"]);
    call(handle, "addParam", "greeting");
    expect(handle.params).toEqual(["who", "greeting"]);
    call(handle, "removeParam", "who");
    expect(handle.params).toEqual(["greeting"]);
    call(handle, "rename", "hail");
    expect(handle.name).toBe("hail");
  });

  it("gives a parameter to a function written without one", () => {
    const { handle } = handleOf("fn greet() => 1");

    call(handle, "addParam", "who");

    expect(handle.params).toEqual(["who"]);
  });

  // Not a lookup table beside the tree: the declaration itself now holds a
  // value, so everything downstream reads what the decorator decided.
  it("binds a `const` to something else, in the tree itself", () => {
    const { node, handle } = handleOf('const plan = "free"');

    expect(handle.value).toBe("free");
    call(handle, "setValue", "pro");

    expect(handle.value).toBe("pro");
    expect(evaluate((node as LetStmt).value, NOTHING)).toBe("pro");
  });

  it("adds and drops the fields of a type", () => {
    const { handle } = handleOf("type User { name: string }");

    expect(handle.fields).toEqual(["name"]);
    call(handle, "addField", "email", "string");
    expect(handle.fields).toEqual(["name", "email"]);
    call(handle, "removeField", "name");
    expect(handle.fields).toEqual(["email"]);
  });

  it("takes the declaration out of the document", () => {
    const { doc, handle } = handleOf('flow "gone" { }\nflow "kept" { }');

    call(handle, "remove");

    expect(doc.decls).toHaveLength(1);
    expect((doc.decls[0] as { title?: string }).title).toBe("kept");
  });

  it("leaves a fact where the scheduler already looks for one", () => {
    const { node, handle } = handleOf('flow "f" { }');

    call(handle, "meta", "tags", ["smoke"]);

    expect(readMeta(node, "tags")).toEqual(["smoke"]);
  });

  it("stores what it was asked to run around a body", () => {
    const { node, handle } = handleOf('flow "f" { }');
    const noop = { lookup: () => undefined };

    call(handle, "before", noop);
    call(handle, "after", noop);

    expect(readDecorations(node)).toMatchObject({ before: [noop], after: [noop] });
  });
});

describe("a verb the kind does not have", () => {
  it("names what that kind does have, instead of vanishing", () => {
    const { handle } = handleOf('flow "f" { }');

    expect(() => handle.addParam).toThrow(ProblemError);
    expect(() => handle.addParam).toThrow(
      "A Flow has no `addParam`. It has name, meta, remove, title, before, after.",
    );
  });

  it("is refused on every kind that lacks it, never as `undefined`", () => {
    const binding = handleOf('const plan = "free"').handle;
    const flow = handleOf('flow "f" { }').handle;

    expect(() => binding.wrap).toThrow("A Binding has no `wrap`");
    expect(() => flow.setValue).toThrow(
      "A Flow has no `setValue`. It has name, meta, remove, title, before, after.",
    );
  });

  it("says why a type alias cannot grow a field", () => {
    const { handle } = handleOf("type Id = string");

    expect(() => call(handle, "addField", "email", "string")).toThrow(
      "`Id` is an alias, so `addField` has no fields to change.",
    );
  });
});

describe("the kind of a node, in the language's own words", () => {
  it("maps each declaration to what a `deco` would call it", () => {
    expect(targetKindOf(firstDecl("fn f() => 1").node)).toBe("Fn");
    expect(targetKindOf(firstDecl('flow "f" { }').node)).toBe("Flow");
    expect(targetKindOf(firstDecl('const x = "1"').node)).toBe("Binding");
    expect(targetKindOf(firstDecl("type T = string").node)).toBe("Type");
    expect(targetKindOf(firstDecl("fragment f() { }").node)).toBe("Node");
  });
});
