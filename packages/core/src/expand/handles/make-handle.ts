import type { AstNode } from "langium";
import { BODY_AROUND_VERBS, CALL_AROUND_VERBS } from "./around-verbs.js";
import { BINDING_VERBS } from "./binding-verbs.js";
import { COMMON_VERBS } from "./common-verbs.js";
import { FN_VERBS } from "./fn-verbs.js";
import type { HandleSurface, TargetHandle, TargetKind, VerbTable } from "./handle.types.js";
import { missingVerb } from "./missing-verb.js";
import { RUNNABLE_VERBS } from "./runnable-verbs.js";
import { TYPE_VERBS } from "./type-verbs.js";

/** What each kind offers, assembled from the slices it shares with the others. */
const SURFACE: Readonly<Record<TargetKind, readonly VerbTable[]>> = {
  Fn: [COMMON_VERBS, FN_VERBS, CALL_AROUND_VERBS],
  Flow: [COMMON_VERBS, RUNNABLE_VERBS, BODY_AROUND_VERBS],
  Step: [COMMON_VERBS, RUNNABLE_VERBS, BODY_AROUND_VERBS],
  Binding: [COMMON_VERBS, BINDING_VERBS],
  Type: [COMMON_VERBS, TYPE_VERBS],
  Node: [COMMON_VERBS],
};

/** Every verb any kind has, so a kind without one can say so instead of vanishing. */
const ALL_VERBS: readonly string[] = [
  ...new Set(Object.values(SURFACE).flatMap((tables) => tables.flatMap(namesOf))),
];

/**
 * The typed mutable handle a decorator holds: verbs over the real declaration.
 *
 * Built like the native members of a list or a string, as a table of names and a
 * value produced on read, because that is what it is: the built-in members of
 * one more kind of value, whose receiver happens to be a piece of the program
 * rather than a piece of its data.
 *
 * Every verb any kind has is installed. The ones this kind lacks throw a
 * `ProblemError` naming the surface it does offer, so a reach for the wrong verb
 * is refused rather than read as nothing.
 */
export function makeHandle(args: { node: AstNode; kind: TargetKind }): TargetHandle {
  const handle: TargetHandle = {};
  const offered = install(handle, args);
  for (const verb of ALL_VERBS) {
    if (!offered.has(verb)) refuse(handle, { verb, kind: args.kind, offered });
  }
  brand(handle, { kind: args.kind, offered: [...offered] });
  return handle;
}

const HANDLE = Symbol("venn.handle");

/**
 * What this handle answers to, or nothing when the value is not one.
 *
 * A getter can only refuse a name some kind has; a name no kind has would still
 * read as nothing. The caller that reaches for one asks here instead, so
 * `target.wobble` is refused in the same sentence as `target.addParam`.
 */
export function handleSurface(value: unknown): HandleSurface | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return (value as { [HANDLE]?: HandleSurface })[HANDLE];
}

function brand(handle: TargetHandle, surface: HandleSurface): void {
  Object.defineProperty(handle, HANDLE, { value: surface });
}

function install(handle: TargetHandle, args: { node: AstNode; kind: TargetKind }): Set<string> {
  const offered = new Set<string>();
  for (const table of SURFACE[args.kind]) {
    for (const [verb, make] of entriesOf(table)) {
      offered.add(verb);
      define(handle, verb, () => make(args.node));
    }
  }
  return offered;
}

function refuse(
  handle: TargetHandle,
  args: { verb: string; kind: TargetKind; offered: Set<string> },
): void {
  define(handle, args.verb, () => {
    throw missingVerb(args);
  });
}

/**
 * Non-enumerable on purpose: a handle is verbs, not data, so serialising one
 * must not run every getter, including the ones whose whole job is to refuse.
 */
function define(handle: TargetHandle, verb: string, get: () => unknown): void {
  Object.defineProperty(handle, verb, { get, configurable: true });
}

function entriesOf(table: VerbTable): [string, (node: AstNode) => unknown][] {
  return [...Object.entries(table.props), ...Object.entries(table.calls)];
}

function namesOf(table: VerbTable): string[] {
  return [...Object.keys(table.props), ...Object.keys(table.calls)];
}
