import type { Span } from "./span.types.js";

/**
 * The span a thrown value's detail carries, when it really is one.
 *
 * `Thrown.detail.where` is a structural claim over a bag: `VennErrorDetail` is
 * `Readonly<Record<string, unknown>>`, so `where` holds whatever the raiser put
 * there and nothing checks it. A plugin using the word for prose, `where: "the
 * checkout page"`, reached the wire as the problem's span, where `problemLines`
 * read `uri` off a string, found nothing and dropped the `at` line, and anything
 * reaching for `span.line` threw.
 *
 * `uri`, `line` and `column` are asked for because they are what every consumer
 * reads. `offset` and `length` are not, so a raiser that knows only the place it
 * is talking about still improves on the enclosing node.
 *
 * @param detail Whatever the throw was carrying, if it carried anything.
 * @returns The span it knew, or nothing at all, so the caller keeps its own.
 */
export function spanIn(detail: { where?: Span } | undefined): Span | undefined {
  const span = detail?.where;
  if (typeof span?.uri !== "string") return undefined;
  return typeof span.line === "number" && typeof span.column === "number" ? span : undefined;
}
