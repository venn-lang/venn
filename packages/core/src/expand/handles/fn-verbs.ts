import { nativeFn } from "../../expr/index.js";
import type { FnDecl, Param, ParamList } from "../../generated/ast.js";
import { boundNames } from "../../pattern/index.js";
import type { VerbTable } from "./handle.types.js";

/**
 * A function's shape: the parameters it takes and the name it answers to.
 *
 * Every one of these edits the declaration itself, before it is compiled, so a
 * parameter added here is in scope for the body that was written without it.
 * That is what `@inject("who")` depends on.
 */
export const FN_VERBS: VerbTable = {
  props: { params: (node) => names(node as FnDecl) },
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
