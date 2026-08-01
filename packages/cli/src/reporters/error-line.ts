import { VennError } from "@venn-lang/contracts";
import { RUN_CODES } from "@venn-lang/runtime";

/**
 * One line for one failure, however it reached us.
 *
 * A `VennError` already knows how it wants to read, and leads with its code so
 * the failure is googlable; anything else is a stray from below the language and
 * gets its message, never `[object Object]`.
 */
export function errorLine(error: unknown): string {
  if (error instanceof VennError) return `${error.code}  ${error.message}`;
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
