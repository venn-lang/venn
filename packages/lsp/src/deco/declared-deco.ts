import {
  type DecoDecl,
  type Document,
  isDecoDecl,
  isNamedType,
  type Param,
  type SingleType,
  type TypeRef,
} from "@venn-lang/core";
import type { LangiumDocument } from "langium";
import { readDoc, renderDoc } from "../docs/index.js";
import type { DecoInfo } from "./deco.types.js";

/**
 * Read a `deco` the way whoever writes `@name` sees it.
 *
 * The first parameter is the target, so the type written on it is what the
 * decorator decorates. Nothing else in the declaration says so, and nothing
 * outside it can disagree.
 */
export function declaredDeco(args: { decl: DecoDecl; document: LangiumDocument }): DecoInfo {
  const { decl, document } = args;
  return {
    name: decl.name,
    decorates: typeNames(decl.params?.params[0]?.paramType),
    signature: signatureOf(decl),
    doc: renderDoc(readDoc(document, decl)),
    decl,
    document,
  };
}

/** Every `deco` a document declares, in the order it declares them. */
export function localDecos(root: Document, document: LangiumDocument): DecoInfo[] {
  return root.decls.filter(isDecoDecl).map((decl) => declaredDeco({ decl, document }));
}

function signatureOf(decl: DecoDecl): string {
  const params = (decl.params?.params ?? []).map(paramText).join(", ");
  return `${decl.export ? "pub " : ""}deco ${decl.name}(${params})`;
}

function paramText(param: Param): string {
  const type = typeNames(param.paramType).join(" | ");
  return type ? `${param.name}: ${type}` : param.name;
}

/** Each alternative of a written type: `Fn | Flow` is two kinds, not one. */
function typeNames(ref: TypeRef | undefined): string[] {
  return (ref?.members ?? []).map(memberName).filter((name) => name.length > 0);
}

// The source's own text, so a generic like `list<number>` survives the trip.
function memberName(member: SingleType): string {
  return member.$cstNode?.text ?? (isNamedType(member) ? member.name : "");
}
