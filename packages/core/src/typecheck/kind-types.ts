import { type TypeSpec, t } from "@venn-lang/types";
import { TARGET_KINDS, type TargetKind } from "../expand/index.js";
import { specToType } from "./spec-to-type.js";
import type { Type } from "./type.types.js";

/** A verb that changes the declaration and answers nothing. */
const NOTHING = t.null;

/** A function left behind to run around the real thing, for effect. */
const AROUND = t.callback([t.dynamic], t.dynamic, 0);

/** `wrap` is handed the call itself and its arguments, and decides. */
const MIDDLEWARE = t.callback([t.dynamic, t.dynamic], t.dynamic, 1);

/** What every handle answers, whatever declaration it is holding. */
const COMMON: Readonly<Record<string, TypeSpec>> = {
  name: t.string,
  meta: t.fn([t.string, t.dynamic], NOTHING),
  remove: t.fn([], NOTHING),
};

/** A flow and a step are one handle: a title, and a way around the body. */
const RUNNABLE: Readonly<Record<string, TypeSpec>> = {
  ...COMMON,
  title: t.string,
  before: t.fn([AROUND], NOTHING),
  after: t.fn([AROUND], NOTHING),
};

/**
 * The kinds, published as types.
 *
 * Written as data, the same data `http.Request` is written as, so the checker,
 * the hover and the completion list read one description of what a target
 * offers. This is the static twin of the verb tables in
 * `expand/handles/make-handle.ts`: whatever a kind has there it has here, and
 * `kind-types.test.ts` fails the day they stop agreeing.
 */
export const KIND_SPECS: Readonly<Record<TargetKind, TypeSpec>> = {
  Fn: t.record({
    ...COMMON,
    params: t.list(t.string),
    paramTypes: t.list(t.string),
    addParam: t.fn([t.string], NOTHING),
    removeParam: t.fn([t.string], NOTHING),
    rename: t.fn([t.string], NOTHING),
    wrap: t.fn([MIDDLEWARE], NOTHING),
    before: t.fn([AROUND], NOTHING),
    after: t.fn([AROUND], NOTHING),
  }),
  Flow: t.record(RUNNABLE),
  Step: t.record(RUNNABLE),
  Binding: t.record({ ...COMMON, value: t.dynamic, setValue: t.fn([t.dynamic], NOTHING) }),
  Type: t.record({
    ...COMMON,
    fields: t.list(t.string),
    addField: t.fn([t.string, t.dynamic], NOTHING),
    removeField: t.fn([t.string], NOTHING),
  }),
  Node: t.record(COMMON),
};

/**
 * The same kinds as the checker's own types, built once.
 *
 * Safe to share across files and across edits: a handle's surface is fixed, so
 * none of these holds an inference variable for a later document to write into.
 */
export const KIND_TYPES: ReadonlyMap<string, Type> = build();

function build(): Map<string, Type> {
  const table = new Map<string, Type>();
  for (const kind of TARGET_KINDS) {
    table.set(
      kind,
      specToType(KIND_SPECS[kind], (name) => table.get(name)),
    );
  }
  return table;
}
