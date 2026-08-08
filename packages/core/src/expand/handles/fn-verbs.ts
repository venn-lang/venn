import { nativeFn } from "../../expr/index.js";
import type { FnDecl, Param, ParamList } from "../../generated/ast.js";
import { boundNames } from "../../pattern/index.js";
import type { VerbTable } from "./handle.types.js";
import { typeRefText } from "./type-ref-text.js";

/**
 * A function's shape: the parameters it takes, their types, and the name it
 * answers to.
 *
 * Every verb here that changes something edits the declaration itself, before
 * it is compiled, so a parameter added here is in scope for the body that was
 * written without it. That is what `@inject("who")` depends on.
 */
export const FN_VERBS: VerbTable = {
  props: {
    params: (node) => names(node as FnDecl),
    paramTypes: (node) => writtenTypes(node as FnDecl),
  },
  calls: {
    addParam: (node) => nativeFn((args) => addParam(node as FnDecl, String(args[0]))),
    removeParam: (node) => nativeFn((args) => removeParam(node as FnDecl, String(args[0]))),
    rename: (node) => nativeFn((args) => rename(node as FnDecl, String(args[0]))),
  },
};

/** Every name the parameters put in scope, which is what a pattern binds. */
function names(decl: FnDecl): string[] {
  return (decl.params?.params ?? []).flatMap(boundNames);
}

/**
 * What each of those names was declared as, in the order `params` answers them.
 *
 * A list beside `params` rather than a `paramType(name)` verb, because the use
 * is a whole signature at once: `@slash` turns a function into a command whose
 * options are its parameters, and it has no idea what they are called. A body
 * has `let`, `const`, `if` and verbs and no loop, so a verb answering one name
 * could only ever be asked about a name written into the decorator itself,
 * which is the one case that does not need it. Two lists hand the signature on
 * whole, to `meta` and from there to whoever builds the options.
 *
 * A parameter written without an annotation answers `""`, the same empty text
 * `name` answers for a declaration that has no name. Nothing was written, and a
 * program tests that with `== ""` where a missing entry would silently shift
 * every type after it onto the wrong name.
 */
function writtenTypes(decl: FnDecl): string[] {
  return (decl.params?.params ?? []).flatMap(typesBound);
}

/**
 * One text per name the parameter binds, so the two lists line up.
 *
 * A parameter written as a shape annotates the shape and not the names taken
 * out of it: in `fn f({ at }: Call)`, `at` is a field of a `Call` and is not
 * one, so it answers the empty text rather than a type it does not have.
 */
function typesBound(param: Param): string[] {
  if (param.name) return [typeRefText(param.paramType)];
  return boundNames(param).map(() => "");
}

function addParam(decl: FnDecl, name: string): null {
  const list = paramList(decl);
  if (!list.params.some((param) => param.name === name)) list.params.push(param(list, name));
  return null;
}

function removeParam(decl: FnDecl, name: string): null {
  const list = decl.params;
  if (!list) return null;
  list.params = list.params.filter((param) => param.name !== name);
  return null;
}

function rename(decl: FnDecl, name: string): null {
  decl.name = name;
  return null;
}

/** A function written `fn f()` has no list at all until something adds to it. */
function paramList(decl: FnDecl): ParamList {
  if (decl.params) return decl.params;
  const list = node<ParamList>({ $type: "ParamList", params: [] }, decl, "params");
  decl.params = list;
  return list;
}

function param(list: ParamList, name: string): Param {
  return node<Param>({ $type: "Param", annotations: [], name }, list, "params");
}

/** A synthesized node, containered the way the parser would have containered it. */
function node<T>(shape: object, container: object, property: string): T {
  return { ...shape, $container: container, $containerProperty: property } as T;
}
