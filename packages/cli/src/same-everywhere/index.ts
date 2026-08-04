/**
 * One language: the same lines, written in each of the places the language
 * compiles them, answering the same.
 *
 * The scheduler interprets statements and `compile/` turns a `fn` body into
 * slot-addressed thunks. Two implementations of one word is where the two
 * quietly disagree, and they have: block scope, assignment to a name the body
 * does not bind, a `let` carrying a verb, and how a loop binds its item were all
 * found by writing the same program twice by hand.
 *
 * So the cases live on disk under `corpus/`, one body per file, and every one is
 * driven in every placement. Two assertions per case: the placements agree,
 * except where the case says why they must not, and each answer is the one
 * pinned in `corpus/expected.json`. Agreement alone is not enough, because both
 * paths can be wrong the same way.
 */

export { createDriver } from "./drive.js";
export { parseCase } from "./parse-case.js";
export { PLACEMENTS, sourceFor } from "./placements.js";
export type {
  Answer,
  Answers,
  Case,
  Driver,
  Pinned,
  Placement,
  Refusal,
} from "./same-everywhere.types.js";
