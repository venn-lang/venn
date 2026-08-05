import {
  type AstNode,
  createContext,
  MEMBER_DOCS,
  memberKind,
  memberType,
  type OpaqueType,
  prune,
  resolveMember,
  showType,
  type Type,
} from "@venn-lang/core";
import type { LangiumDocument } from "langium";
import type { CompletionItem, CompletionItemKind, Range } from "vscode-languageserver";
import { findBinding } from "../document/index.js";
import type { TypeService } from "../types/index.js";
import { ICON } from "./icons.js";
import { item } from "./items.js";
import { receiverTypeAt } from "./read-from.js";

export interface MemberArgs {
  /** The dotted path before the cursor's dot: `p`, `cfg.server`. */
  receiver: string;
  /** A node inside the file, for looking the head up in scope. */
  host: AstNode;
  document: LangiumDocument;
  types: TypeService;
  range: Range;
}

/**
 * What a value offers after a dot: the built-ins of its type, plus the fields it
 * carries when it is a map. Driven by the same inference the checker runs, so
 * `p` inside `people.filter(fn (p) => …)` completes as a person, not as nothing.
 */
export function memberItems(args: MemberArgs): CompletionItem[] {
  const type = receiverType(args);
  if (!type) return [];
  return [...fieldItems(type, args.range), ...builtinItems(type, args.range)];
}

/** Walk the path from the binding the file declared to the type it holds here. */
function receiverType(args: MemberArgs): Type | undefined {
  const segments = args.receiver.split(".");
  const head = segments[0];
  const binding = head ? findBinding(args.host, head) : undefined;
  let type = binding && args.types.of(args.document).types.get(binding);
  for (const name of segments.slice(1)) {
    if (!type) return undefined;
    type = resolveMember(type, name, createContext());
  }
  return type && prune(type);
}

/**
 * How the editor orders what comes after a dot.
 *
 * What the value is comes before what every value of its kind can do: someone
 * who typed `price.` wants `id` and `price`, not the dozens of built-ins that
 * are the same on every map in the language.
 */
const OWN = "0";
const BUILT_IN = "1";

/**
 * What the value itself carries: a map's fields, a handle's published verbs.
 *
 * `regex` and `task` are left to `builtinItems`, which offers the same names
 * with the prose and the example beside them. Offering both listed each twice.
 */
function fieldItems(type: Type, range: Range): CompletionItem[] {
  if (type.kind === "opaque") return memberKind(type) ? [] : publishedItems(type, range);
  if (type.kind !== "record") return [];
  return [...type.fields].map(([name, field]) => ({
    ...item({
      label: name,
      kind: kindOf(field, true),
      range,
      detail: showType(field),
      documentation: "Field of this map.",
    }),
    sortText: `${OWN}${name}`,
  }));
}

/**
 * Which of three things this member is.
 *
 * The icon answers the question the reader is about to act on: do I write
 * brackets? A method needs `(…)`; everything else is written bare. Of the bare
 * ones, a field is data the value carries and a property is computed on read.
 */
function kindOf(member: Type, stored: boolean): CompletionItemKind {
  if (member.kind === "fn") return ICON.method;
  return stored ? ICON.key : ICON.computed;
}

/**
 * What a handle publishes, and only that. A server is not a map: it answers to
 * `close`, never to `merge`, so offering `merge` would invite code that cannot
 * work.
 */
function publishedItems(type: OpaqueType, range: Range): CompletionItem[] {
  return [...(type.members ?? [])].map(([name, member]) => ({
    ...item({
      label: name,
      kind: kindOf(member, false),
      range,
      detail: showType(member),
      documentation: `Published by \`${type.name}\`.`,
    }),
    sortText: `${OWN}${name}`,
  }));
}

function builtinItems(type: Type, range: Range): CompletionItem[] {
  const kind = memberKind(type);
  const docs = kind ? MEMBER_DOCS[kind] : undefined;
  if (!kind || !docs) return [];
  return Object.entries(docs).map(([name, doc]) => {
    const member = memberType(type, name, createContext());
    return {
      ...item({
        label: name,
        kind: member ? kindOf(member, false) : ICON.method,
        range,
        detail: member ? showType(member) : undefined,
        documentation: doc.example ? `${doc.doc}\n\n${doc.example}` : doc.doc,
      }),
      sortText: `${BUILT_IN}${name}`,
    };
  });
}

/**
 * The members of whatever the node under the cursor evaluates to.
 *
 * For a receiver no path can name (`(1234.567).`, `f(x).`, `xs[0].`) there is
 * nothing to look up by text, but the checker already typed the expression.
 */
export function membersOfNode(args: {
  host: AstNode;
  /** Where the cursor is: what tells a finished member from one being typed. */
  at: number;
  document: LangiumDocument;
  types: TypeService;
  range: Range;
}): CompletionItem[] {
  const types = args.types.of(args.document).types;
  const type = receiverTypeAt({ host: args.host, at: args.at, document: args.document, types });
  if (!type) return [];
  return [...fieldItems(type, args.range), ...builtinItems(type, args.range)];
}
