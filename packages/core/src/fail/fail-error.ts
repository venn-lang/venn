import { buildProblem, CODES } from "../codes/index.js";
import { ProblemError, type Span } from "../problem/index.js";

/**
 * Codes beginning `VN` belong to the language.
 *
 * Every one of them is catalogued, documented and searchable, and a program
 * raising `VN7010` to mean its own thing is a program whose failures cannot be
 * told from the ones the language raises. What a program calls its failures is
 * otherwise its own business: no registry, no range to claim.
 */
const KERNEL = /^vn\d/i;

/**
 * Whether this code is one the language owns, so a program may not claim it.
 *
 * Exported because the same question is asked twice, once by the checker where
 * the code is written out and once here where a computed one arrives, and the
 * two must answer alike or a program could smuggle one past the first.
 *
 * @param code The code a `fail` was written or computed with.
 * @returns Whether it begins `VN` followed by a digit, in any case.
 */
export function beginsWithVN(code: string): boolean {
  return KERNEL.test(code);
}

/** Why a code beginning `VN` is refused, in the one sentence the language uses. */
export function reservedCodeTitle(written: string): string {
  return `"${written}" begins with VN, and those codes belong to the language.`;
}

/** What to do about it, which is the only advice a chosen name needs. */
export const NAME_IT_AFTER_WHAT_HAPPENED =
  "Name it after what happened: `pay.declined`, `cart.empty`.";

/**
 * The failure a `fail` raises, wherever the `fail` is written.
 *
 * `fail "…"` alone raises the one code a program had, so a library could not
 * raise a failure a caller could tell apart from any other. A code and a payload
 * are what make `if e.code == "pay.declined"` a question worth asking.
 *
 * Here in the kernel rather than beside the scheduler, because a `fn` body is
 * compiled and has no scheduler to ask: the compiler raises this and so does
 * `runPrelude`, so `catch e { e.code }` reads the same thing whether the `fail`
 * was written in a `fn`, in a `fragment` or at the top of a file.
 *
 * @param args.message The line the `fail` was given, in the product's voice.
 * @param args.opts The `{ code, data }` written beside it, already evaluated.
 * @param args.where The span of the `fail` itself, which is what a reader wants
 * pointed at rather than the step or the body around it.
 * @returns The failure to throw, carrying the whole problem it reports as.
 */
export function failError(args: {
  message: string;
  opts: Record<string, unknown>;
  where: Span;
}): ProblemError {
  const code = codeOf(args.opts.code);
  if (code === undefined) return reserved(String(args.opts.code), args.where);
  const data = args.opts.data ?? null;
  return raised({ code, message: args.message || "fail", data, where: args.where });
}

/** The code to raise under, or nothing when the program claimed one of ours. */
function codeOf(written: unknown): string | undefined {
  if (written === undefined || written === null) return CODES.VN6002_FAILED.code;
  const code = String(written);
  return beginsWithVN(code) ? undefined : code;
}

/**
 * The failure, carrying the problem it reports as rather than leaving it to be
 * worked out later.
 *
 * `pay.declined` is a code the program chose and `ENOENT` is one that escaped
 * from Node, and no predicate tells those apart: neither begins with `VN`,
 * because VN3022 refuses that from user code. So `problemOf` reports an
 * uncatalogued code only where the throw vouched for it by carrying a whole
 * problem, and this is the one raiser that can. Without it the flagship code of
 * the error model reached the reporter as `VN7000`.
 *
 * Built through `buildProblem` like every other raiser, so a `fail` with no code
 * of its own carries the same docs link a compile diagnostic does, and a code
 * the program chose carries none because there is no page to send a reader to.
 *
 * The span travels in `detail` as well as in the problem, because that is where
 * a reporter looks for the raiser's own line when the problem was rebuilt.
 */
function raised(args: { code: string; message: string; data: unknown; where: Span }): ProblemError {
  const problem = buildProblem({
    spec: { code: args.code, severity: "error" },
    span: args.where,
    title: args.message,
  });
  return new ProblemError(problem, { data: args.data, where: args.where });
}

/** A code the language owns, refused where the `fail` stands. */
function reserved(written: string, where: Span): ProblemError {
  return new ProblemError(
    {
      ...buildProblem({
        spec: CODES.VN3022_RESERVED_CODE,
        span: where,
        title: reservedCodeTitle(written),
      }),
      help: NAME_IT_AFTER_WHAT_HAPPENED,
    },
    { data: null, where },
  );
}
