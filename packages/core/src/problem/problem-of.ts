import type { Problem } from "./problem.types.js";
import type { Span } from "./span.types.js";
import { spanIn } from "./span-in.js";
import type { Thrown } from "./thrown.types.js";

/** The code a failure that carried none of its own is reported under. */
export const UNKNOWN_CODE = "VN7000";

/**
 * Whatever was thrown, as the `Problem` every reporter reads.
 *
 * A failure works out its own code, its own place and often its own advice, and
 * then has to survive being caught somewhere that knows none of that. The
 * answer is to ask the throw rather than its class: a `ProblemError` already
 * holds a whole problem, a `VennError` holds a code and puts its span in
 * `detail.where`, and anything from below the language holds neither.
 *
 * What a throw carries is read, never taken on trust. Both of those fields are
 * structural claims that nothing enforces, and every `Error` in existence
 * carries a `.code` of some sort, so each is checked against the shape the rest
 * of the system was promised.
 *
 * The span given here is the fallback, not an override: a failure that knows
 * where it happened keeps that, because the enclosing node is a worse answer
 * than the raiser's own line.
 *
 * @param args.thrown Whatever unwound.
 * @param args.span Where to say it happened, for a failure that does not know.
 * @returns The failure as a `Problem`, never widened and never flattened.
 */
export function problemOf(args: { thrown: unknown; span: Span }): Problem {
  const held = args.thrown as Thrown | undefined;
  if (held?.problem) return held.problem;
  return {
    ...codeOf(held?.code),
    severity: "error",
    title: titleOf(args.thrown, held),
    span: spanIn(held?.detail) ?? args.span,
  };
}

/** Every code the language catalogues, and the only shape a reporter may key on. */
const VENN_CODE = /^VN\d{4}$/;

/**
 * The code to report under, and what to say about the one that was refused.
 *
 * Every `Error` from below the language carries a `.code` too, so a plugin
 * letting one escape used to put `ENOENT` on the failure envelope, where junit
 * writes `type="ENOENT"` and pretty leads with it exactly as it leads with ours.
 * A code-keyed CI filter, a docs link and the catalogue then all miss it.
 *
 * A code a program chose for itself, `pay.declined`, cannot be told from
 * `ENOENT` by shape, and the language refuses a `VN` code from user code so it
 * cannot be by prefix either. So it is not guessed at here: whoever chose it
 * vouches for it by carrying the whole `Problem`, which is returned above
 * untouched. `failError` does exactly that.
 *
 * The refused code becomes a `note` rather than being dropped. A message does
 * not always repeat it, and `VN7000  No element matched #pay.` leaves a
 * maintainer with nothing to search the plugin for.
 */
function codeOf(code: string | undefined): { code: string; note?: string } {
  if (code !== undefined && VENN_CODE.test(code)) return { code };
  if (code === undefined || code === "") return { code: UNKNOWN_CODE };
  const note = `It came with the code "${code}", which is not one of ours.`;
  return { code: UNKNOWN_CODE, note };
}

/**
 * One line, in the voice of whoever raised it.
 *
 * `String(thrown)` is the last resort and reads as `Error: …`, which is the
 * runtime talking about itself, so a message is preferred wherever there is one.
 */
function titleOf(thrown: unknown, held: Thrown | undefined): string {
  const message = held?.message;
  return typeof message === "string" && message !== "" ? message : String(thrown);
}
