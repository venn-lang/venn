import type { AstNode } from "langium";
import type { DecoratorDefinition } from "./expand.types.js";
import { TARGET_KINDS, type TargetKind, targetKindOf } from "./handles/index.js";

/** What each kind is called in a sentence someone reads. */
const KIND_WORDS: Readonly<Record<TargetKind, string>> = {
  Fn: "a function",
  Flow: "a flow",
  Step: "a step",
  Binding: "a binding",
  Type: "a type",
  Node: "anything",
};

/**
 * What a node is called in that same sentence.
 *
 * Wider than {@link KIND_WORDS} on purpose: a fragment and a group have no kind
 * of their own, but a message that cannot name what the author actually wrote
 * is a message that sends them looking for it.
 */
const NODE_WORDS: Readonly<Record<string, string>> = {
  FnDecl: "a function",
  FlowDecl: "a flow",
  StepDecl: "a step",
  GroupDecl: "a group",
  LetStmt: "a binding",
  TypeDecl: "a type",
  FragmentDecl: "a fragment",
  DecoDecl: "a decorator",
  FieldDecl: "a field",
  Param: "a parameter",
  ActionCall: "a call",
};

/** A list of alternatives, read the way it is spoken: "a flow, a step or a group". */
function oneOf(words: readonly string[]): string {
  const all = [...words];
  const last = all.pop();
  return all.length === 0 ? (last ?? "") : `${all.join(", ")} or ${last}`;
}

/** The kinds a signature allows, read as prose: "a function or a flow". */
export function kindWords(kinds: readonly TargetKind[]): string {
  return oneOf(kinds.map((kind) => KIND_WORDS[kind]));
}

/** Every kind, listed for an author who has to pick one. */
export function everyKindWritten(): string {
  return oneOf(TARGET_KINDS);
}

/**
 * What a node is called for someone reading a message.
 *
 * A plugin's decorator may name any node it is able to read, so an unlisted one
 * has its word derived rather than printed: `FlowDecl` is the compiler talking
 * to itself, and a word nobody ever typed has no business on a user's screen.
 */
export function nodeWord(type: string): string {
  return NODE_WORDS[type] ?? `a ${type.replace(/(Decl|Stmt|Expr|Lit)$/, "").toLowerCase()}`;
}

/** "@memoize decorates a function, and this is a flow." */
export function wrongKindTitle(args: {
  name: string;
  kinds: readonly TargetKind[];
  node: AstNode;
}): string {
  return `@${args.name} decorates ${kindWords(args.kinds)}, and this is ${nodeWord(args.node.$type)}.`;
}

/**
 * The same sentence for a plugin's decorator, whose reach is a list of node
 * types. It still reads as prose: what the author wrote is what they are told
 * about, and the list they never wrote stays out of it.
 */
export function wrongTargetTitle(args: {
  name: string;
  targets: readonly string[];
  node: AstNode;
}): string {
  const allowed = oneOf([...new Set(args.targets.map(nodeWord))]);
  return `@${args.name} decorates ${allowed}, and this is ${nodeWord(args.node.$type)}.`;
}

/**
 * Why a `@name` does not belong on this node, if it does not.
 *
 * Nothing when the signature never said which kinds it takes: that is a fault
 * committed once, where the `deco` is written, and repeating it at every use
 * site would bury the one message that can be acted on.
 */
export function wrongKind(args: {
  name: string;
  kinds: readonly TargetKind[];
  node: AstNode;
}): string | undefined {
  const { kinds, node } = args;
  if (kinds.length === 0 || kinds.includes("Node") || kinds.includes(targetKindOf(node)))
    return undefined;
  return wrongKindTitle(args);
}

/**
 * Why a decorator does not belong where it is written, if it does not.
 *
 * A `deco` says what it decorates by typing its first parameter, so the answer
 * is phrased in the words the author used. A plugin's or a built-in's decorator
 * still names node types, because it is handed the raw node and nothing shorter
 * describes what it is able to read.
 *
 * Expansion asks this before it runs a decorator, and the static check asks it
 * before anything runs at all. One question, one answer, one sentence: a
 * decorator in the wrong place must not read differently depending on which of
 * the two found it.
 *
 * @param args `found` is the definition the name resolved to, `node` is what it
 * was written on, and `name` is what the author wrote after the `@`.
 * @returns The sentence to refuse it with, or nothing when it belongs here.
 * @throws Nothing.
 */
export function wrongPlace(args: {
  found: DecoratorDefinition;
  node: AstNode;
  name: string;
}): string | undefined {
  const { found, node, name } = args;
  if (found.accepts) return wrongKind({ name, kinds: found.accepts, node });
  if (!found.targets || found.targets.includes(node.$type)) return undefined;
  return wrongTargetTitle({ name, targets: found.targets, node });
}
