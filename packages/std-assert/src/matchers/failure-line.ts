/** A failure title is one line. Past this, a value is cut short. */
const LIMIT = 44;

/**
 * Builds the line a failure leads with: `expected <subject> <relation> <other>`.
 *
 * The values are written by `show`, the language's one renderer, so a red check
 * and a `print` of the same value agree about what it looks like. What this file
 * decides is width, not shape: a title is one line, so a value past the budget is
 * cut where it stands rather than rewritten into prose. Nothing is lost, the full
 * values travel in the problem's diff.
 *
 * @param args The subject, how the matcher relates it to the other side, that
 * other side, and the renderer the runtime handed the matcher (`ctx.show`).
 * @returns The one-line title, each side at most a line's worth.
 */
export function failureLine(args: {
  subject: unknown;
  relation: string;
  other: unknown;
  show: (value: unknown) => string;
}): string {
  const left = side(args.subject, args.show);
  const right = side(args.other, args.show);
  return `expected ${left} ${args.relation} ${right}`;
}

/**
 * One side of the line: written, then fitted.
 *
 * A string is quoted, the one thing `show` answers differently. A value on its
 * own reads bare, so that `print name` gives `ada` rather than `"ada"`, while a
 * value standing among others is quoted, and a side of a comparison stands among
 * others. Bare here, `expect "200" equals 200` would fail with
 * `expected 200 to equal 200`, a line nobody can act on.
 */
function side(value: unknown, show: (value: unknown) => string): string {
  return fit(typeof value === "string" ? JSON.stringify(value) : show(value));
}

function fit(text: string): string {
  return text.length <= LIMIT ? text : `${text.slice(0, LIMIT)}…`;
}
