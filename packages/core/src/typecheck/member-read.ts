/**
 * How a member read is typed, whichever way the source spelled it.
 *
 * One answer for `m.name` and `m["name"]`, because they are one question. They
 * used to be typed in two places: `inferMember` asked the built-in table, then
 * the record's fields, then reported; `inferIndex` answered the element type
 * for a list and `dynamic` for everything else, which is how
 * `const t: number = m["name"]` passed a check that `m.name` failed.
 */

import type { Expr } from "../generated/ast.js";
import { memberType } from "./builtins.js";
import type { TypeMismatch } from "./context.js";
import type { Infer } from "./infer.js";
import type { MemberRead } from "./member-read.types.js";
import { showType } from "./show.js";
import { DYNAMIC, type RecordType, type Type, type UnionType, union } from "./type.types.js";
import { fieldType, prune } from "./unify.js";

/**
 * What a member read answers with, reporting when the receiver's members are
 * all known and this is not one of them.
 *
 * @param receiver The pruned type being read.
 * @param read Which member, written how, and where.
 * @param infer Where fresh variables and mismatches go.
 * @returns The member's type, or `dynamic` when nothing here can say.
 */
export function memberRead(receiver: Type, read: MemberRead, infer: Infer): Type {
  const built = memberType(receiver, read.name, infer.ctx);
  if (built) return built;
  if (receiver.kind === "record") return recordField(receiver, read, infer);
  if (receiver.kind === "union") return unionField(receiver, read, infer);
  return unknownMember(receiver, read, infer);
}

/**
 * A field on a union: every branch's answer, as one type.
 *
 * A field only some shapes carry is the whole reason narrowing exists, so it is
 * reported rather than answered with `dynamic`: inside `if r.kind == "ok"` the
 * value is one shape, and the field is there. Only shapes, though. A
 * `string | number` is a value two things could be rather than a decision
 * somebody has to make, and reading it has always been the run's business.
 */
function unionField(receiver: UnionType, read: MemberRead, infer: Infer): Type {
  const found = receiver.members.map((member) => branchField(member, read.name));
  if (found.every((type) => type !== undefined)) return union(found as Type[]);
  if (read.asking || !receiver.members.every(isShape)) return DYNAMIC;
  infer.ctx.mismatches.push({
    node: read.node,
    expected: receiver,
    actual: DYNAMIC,
    note: `does not carry "${read.name}" on every branch`,
  });
  return DYNAMIC;
}

/** A branch whose fields are all known, which is what makes a missing one wrong. */
function isShape(member: Type): boolean {
  return prune(member).kind === "record";
}

/** What one branch of a union answers for a field, or nothing when it has none. */
function branchField(member: Type, name: string): Type | undefined {
  const t = prune(member);
  if (t.kind === "dynamic" || t.kind === "var") return DYNAMIC;
  return t.kind === "record" ? fieldType(t, name) : undefined;
}

/**
 * The kinds whose members are all known: a string, a list, a handle, a literal.
 *
 * There is no shape one of these could turn out to have later, so answering
 * `dynamic` for a member it does not carry is not caution but a wrong answer.
 * Anything still open, `dynamic` above all, is left alone.
 */
const CLOSED_MEMBERS = new Set(["list", "prim", "opaque", "literal"]);

function unknownMember(receiver: Type, read: MemberRead, infer: Infer): Type {
  if (!CLOSED_MEMBERS.has(receiver.kind) || read.asking) return DYNAMIC;
  infer.ctx.mismatches.push({
    node: read.node,
    expected: receiver,
    actual: DYNAMIC,
    note: `has no member "${read.name}"`,
  });
  return DYNAMIC;
}

function recordField(receiver: RecordType, read: MemberRead, infer: Infer): Type {
  const found = fieldType(receiver, read.name);
  if (found) return found;
  if (read.asking) return DYNAMIC;
  infer.ctx.mismatches.push(noSuchField(receiver, read));
  return DYNAMIC;
}

/**
 * A write gets its own sentence, because the reader's way out is a different
 * one.
 *
 * `stats["hits"] = 1` on a `{}` is refused for the same reason the read is: the
 * shape lists no such field, and a shape is what `{}` infers to. But a reader
 * told only that the field is not there is being told about the value they are
 * writing rather than about the map they are writing it into, and the two fixes
 * are not the same fix.
 */
function noSuchField(receiver: RecordType, read: MemberRead): TypeMismatch {
  const at = { node: read.node, expected: receiver, actual: DYNAMIC };
  if (!isWritten(read.node)) return { ...at, note: `has no field "${read.name}"` };
  return {
    ...at,
    sentence: `Type ${showType(receiver)} has no field "${read.name}" to write to.`,
    help: "List the field where the map is made, or annotate the binding as a map so a key it does not name may be written: `let stats: map<number> = {}`.",
  };
}

/** Whether this read is where a value is going rather than where one comes from. */
function isWritten(node: Expr): boolean {
  return node.$container?.$type === "AssignStmt" && node.$containerProperty === "target";
}
