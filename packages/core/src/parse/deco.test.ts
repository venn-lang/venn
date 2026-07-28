import { describe, expect, it } from "vitest";
import type {
  Annotation,
  DecoDecl,
  Document,
  FieldDecl,
  FnDecl,
  NamedType,
  Param,
  TypeDecl,
} from "../generated/ast.js";
import { parse } from "./parse.js";

/** Parse a whole document, insisting the grammar accepted every word of it. */
function document(source: string): Document {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  return ast;
}

const decoIn = (source: string): DecoDecl => document(source).decls[0] as DecoDecl;

const paramsOf = (decl: DecoDecl | FnDecl): Param[] => decl.params?.params ?? [];

/** The type written on a parameter, as the source spelled it. */
function writtenType(param: Param | undefined): string[] {
  return (param?.paramType?.members ?? []).map((member) => (member as NamedType).name);
}

const decoratorNames = (node: { annotations: Annotation[] }): string[] =>
  node.annotations.map((annotation) => annotation.name);

const MEMOIZE = `deco memoize(target: Fn) {
  const cache = {}
  target.wrap(fn (call, args) => cache.get(str(args)) ?? call(args))
}
`;

const RETRY = `pub deco retry(target: Flow, times: number) {
  target.meta "retry" times
}
`;

const USER = `type User {
  @secret
  password: string
  @doc("id") @pk id: int
  email?: string
}
`;

/**
 * A decorator the language declares about itself. The first parameter is the
 * target and the type on it is what the decorator decorates, so `deco` needs no
 * vocabulary of node names to say what it applies to.
 */
describe("deco declarations", () => {
  it("declares a name, a target and a body", () => {
    const deco = decoIn(MEMOIZE);

    expect(deco.$type).toBe("DecoDecl");
    expect(deco.name).toBe("memoize");
    expect(deco.export).toBeFalsy();
    expect(paramsOf(deco).map((param) => param.name)).toEqual(["target"]);
    expect(writtenType(paramsOf(deco)[0])).toEqual(["Fn"]);
  });

  it("runs a block of statements, not a single expression like `fn`", () => {
    const deco = decoIn(MEMOIZE);

    expect(deco.body.$type).toBe("Block");
    expect(deco.body.stmts.map((stmt) => stmt.$type)).toEqual(["LetStmt", "ActionCall"]);
  });

  it("is exported by `pub`, the same flag `pub fn` sets", () => {
    const exported = decoIn(`pub deco tag(target: Node) { target.meta "tag" true }\n`);
    const fn = document(`pub fn twice(n: number) => n * 2\n`).decls[0] as FnDecl;

    expect(exported.export).toBe(true);
    expect(fn.export).toBe(true);
  });

  it("takes its own arguments after the target, each one typed", () => {
    const deco = decoIn(RETRY);

    expect(paramsOf(deco).map((param) => param.name)).toEqual(["target", "times"]);
    expect(writtenType(paramsOf(deco)[0])).toEqual(["Flow"]);
    expect(writtenType(paramsOf(deco)[1])).toEqual(["number"]);
  });

  it("lets a target name more than one kind", () => {
    const deco = decoIn(`deco note(target: Fn | Flow | Step) { target.meta "note" true }\n`);

    expect(writtenType(paramsOf(deco)[0])).toEqual(["Fn", "Flow", "Step"]);
  });

  it("carries decorators of its own", () => {
    const deco = decoIn(`@internal\ndeco memo(target: Node) { target.meta "memo" true }\n`);

    expect(decoratorNames(deco)).toEqual(["internal"]);
    expect(deco.name).toBe("memo");
  });

  // `deco` joins `fn` and `flow` in the keyword list, and like them stays legal
  // wherever a word is only ever a word: a member, a map key, a qualified tail.
  it("does not take the word `deco` away from members and map keys", () => {
    const doc = document(`const a = { deco: 1 }\nconst b = a.deco\n`);

    expect(doc.decls).toHaveLength(2);
    expect(doc.decls[1]?.$type).toBe("LetStmt");
  });
});

/** "Decorate anything" includes the two places that had no room for a `@` yet. */
describe("decorators on parameters and fields", () => {
  it("attaches to a parameter, with or without arguments", () => {
    const fn = document(`fn greet(@upper name: string, @doc("who") other) => name\n`)
      .decls[0] as FnDecl;
    const [name, other] = paramsOf(fn);

    expect(decoratorNames(name as Param)).toEqual(["upper"]);
    expect(decoratorNames(other as Param)).toEqual(["doc"]);
    expect(other?.annotations[0]?.args?.args).toHaveLength(1);
  });

  it("attaches to a type field, on its own line or in front of it", () => {
    const type = document(USER).decls[0] as TypeDecl;
    const fields = (type.body?.fields ?? []) as FieldDecl[];

    expect(fields.map((field) => field.name)).toEqual(["password", "id", "email"]);
    expect(fields.map(decoratorNames)).toEqual([["secret"], ["doc", "pk"], []]);
    expect(fields[2]?.optional).toBe(true);
  });
});
