import { type AstNode, createContext, isPrelude, resolveMember, type Type } from "@venn-lang/core";
import type { LangiumDocument } from "langium";
import type { SymbolCatalog } from "../catalog/index.js";
import { findBinding } from "../document/index.js";
import type { TypeService } from "../types/index.js";
import { actionHover } from "./render-action.js";
import { bindingHover } from "./render-decl.js";
import { memberHover, namespaceHover, preludeHover } from "./render-symbol.js";

export interface ResolveArgs {
  /** The dotted path under the cursor, e.g. `people.maxBy`. */
  path: string;
  /** Which segment the cursor sits on; `0` is the head. */
  segment: number;
  /** A node inside the file, for looking a name up in scope. */
  host: AstNode;
  document: LangiumDocument;
  catalog: SymbolCatalog;
  types: TypeService;
}

/**
 * Describe what a dotted path refers to, wherever it is written: a prelude verb,
 * a plugin namespace or one of its actions, a built-in member of a value, or a
 * binding the file declared.
 *
 * It resolves from the path's text rather than from parsed nodes, because an
 * expression inside `"${…}"` is parsed apart from the document. That way the
 * same name reads the same in both places.
 */
export function resolveSymbol(args: ResolveArgs): string | undefined {
  const segments = args.path.split(".");
  const head = segments[0];
  if (!head) return undefined;
  const binding = findBinding(args.host, head);
  if (args.segment === 0) return headHover({ head, binding, args });
  if (!binding && args.catalog.hasNamespace(head)) return actionHover(args.path, args.catalog);
  return memberOf({ segments, binding, args });
}

/** The first segment: something the file bound, a namespace, or a prelude name. */
function headHover(input: {
  head: string;
  binding: AstNode | undefined;
  args: ResolveArgs;
}): string | undefined {
  const { head, binding, args } = input;
  if (binding) {
    return bindingHover({
      document: args.document,
      node: args.host,
      name: head,
      types: args.types,
    });
  }
  return namespaceHover(head, args.catalog) ?? (isPrelude(head) ? preludeHover(head) : undefined);
}

/** `xs.map`, `cfg.server.port`: walk to the receiver, then describe its member. */
function memberOf(input: {
  segments: readonly string[];
  binding: AstNode | undefined;
  args: ResolveArgs;
}): string | undefined {
  const { segments, binding, args } = input;
  const member = segments[args.segment];
  let receiver = binding && args.types.of(args.document).types.get(binding);
  if (!receiver || !member) return undefined;
  for (const step of segments.slice(1, args.segment)) {
    const next = resolveMember(receiver, step, createContext());
    if (!next) return undefined;
    receiver = next;
  }
  return memberHover({ receiver, member });
}

export type { Type };
