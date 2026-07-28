import type { Diff, Problem, RelatedInfo, Span } from "../problem/index.js";
import type { CodeSpec } from "./code.types.js";

/** Construct a {@link Problem} from a catalog spec plus location and message. */
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
  };
}
