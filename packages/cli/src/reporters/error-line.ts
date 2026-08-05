import { RUN_CODES } from "@venn-lang/runtime";
import type { Stream } from "./colors.types.js";
import { problemDetail } from "./problem-detail.js";
import { problemThrown } from "./problem-thrown.js";

/**
 * One line for one failure, however it reached us.
 *
 * A throw that carries a code of ours says everything it knows: the code, so the
 * failure is googlable, then where it happened and what to do about it. Reading
 * the throw rather than its class is what keeps this true of a `ProblemError`
 * from the kernel, of a `VennError` from a port, and of anything else that
 * carries one. Anything else is a stray from below the language and gets its
 * message, never `[object Object]`.
 *
 * @param error Whatever was thrown.
 * @param stream Where the line is going, since colour is decided per stream.
 * Standard error by default, which is where every failure the CLI writes goes,
 * and it is a file as often as a terminal.
 * @returns The failure as text, one line unless a problem had more to say.
 */
export function errorLine(error: unknown, stream: Stream = process.stderr): string {
  const problem = problemThrown(error);
  if (problem) {
    return [`${problem.code}  ${problem.title}`, ...problemDetail(problem, { stream })].join("\n");
  }
  const tooDeep = wentTooDeep(error);
  if (tooDeep) return tooDeep;
  const message = (error as { message?: unknown } | undefined)?.message;
  return typeof message === "string" && message !== "" ? message : String(error);
}

/**
 * A function that never stopped calling itself.
 *
 * Read here rather than caught where a call happens: every call would pay for a
 * `try` that almost never fires, and this is the one place the failure has to
 * become a sentence anyway. What escapes is the machine's own `RangeError`,
 * whose message names a stack the program never wrote.
 */
function wentTooDeep(error: unknown): string | undefined {
  if (!(error instanceof RangeError) || !error.message.includes("call stack")) return undefined;
  return `${RUN_CODES.VN8003_TOO_DEEP}  This went too deep: something calls itself and never stops.`;
}
