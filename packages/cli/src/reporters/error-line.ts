import { VennError } from "@venn/contracts";

/**
 * One line for one failure, however it reached us.
 *
 * A `VennError` already knows how it wants to read, and leads with its code so
 * the failure is googlable; anything else is a stray from below the language and
 * gets its message, never `[object Object]`.
 */
export function errorLine(error: unknown): string {
  if (error instanceof VennError) return `${error.code}  ${error.message}`;
  const message = (error as { message?: unknown } | undefined)?.message;
  return typeof message === "string" && message !== "" ? message : String(error);
}
