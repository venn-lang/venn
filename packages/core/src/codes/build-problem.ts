import { type Diff, docsFor, type Problem, type RelatedInfo, type Span } from "../problem/index.js";
import type { CodeSpec } from "./code.types.js";

/**
 * Construct a {@link Problem} from a catalog spec plus location and message.
 *
 * The `docs` link is derived here rather than written at each raise site. Every
 * problem the kernel makes passes through this function holding its
 * {@link CodeSpec}, so one line gives the terminal, the editor and a program's
 * `catch` the same URL, and no raise site can forget it or let it go stale.
 *
 * @param args.spec The catalog entry, which carries the code and its severity.
 * @param args.span Where in the source it happened.
 * @param args.title One line in the reader's terms.
 * @param args.help What to do about it, when the producer knows.
 * @param args.related Other places worth looking at.
 * @param args.diff What was expected against what arrived.
 * @param args.note Why the rule exists.
 * @returns The problem, with `docs` pointing at this code's page when the code
 * is one of the language's own.
 */
export function buildProblem(args: {
  spec: CodeSpec;
  span: Span;
  title: string;
  help?: string;
  related?: RelatedInfo[];
  diff?: Diff;
  note?: string;
}): Problem {
  return {
    code: args.spec.code,
    severity: args.spec.severity,
    title: args.title,
    span: args.span,
    help: args.help,
    related: args.related,
    diff: args.diff,
    note: args.note,
    docs: docsFor(args.spec.code),
  };
}
