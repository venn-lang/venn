import { VennError } from "@venn-lang/contracts";
import { buildProblem, CODES, type Span } from "@venn-lang/core";
import { RUN_CODES } from "../codes.js";

/**
 * The failure a `fail` raises.
 *
 * `fail "…"` alone raises the one code a program had, so a library could not
 * raise a failure a caller could tell apart from any other. A code and a payload
 * are what make `if e.code == "pay.declined"` a question worth asking.
 */
export function failError(args: {
  message: string;
  opts: Record<string, unknown>;
  where: Span;
}): VennError {
  const code = codeOf(args.opts.code);
  if (code === undefined) return reservedCode(String(args.opts.code));
  const data = args.opts.data ?? null;
  return raised({ code, message: args.message || "fail", data, where: args.where });
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
 */
function raised(args: { code: string; message: string; data: unknown; where: Span }): VennError {
  const problem = buildProblem({
    spec: { code: args.code, severity: "error" },
    span: args.where,
    title: args.message,
  });
  // Where it was raised, which the runtime knows and a `VennError` has nowhere
  // else to put: it carries a code and a message and no span.
  const detail = { data: args.data, where: args.where };
  return Object.assign(new VennError({ code: args.code, message: args.message, detail }), {
    problem,
  });
}

/**
 * Codes beginning `VN` belong to the language.
 *
 * Every one of them is catalogued, documented and searchable, and a program
 * raising `VN7010` to mean its own thing is a program whose failures cannot be
 * told from the ones the language raises. What a program calls its failures is
 * otherwise its own business: no registry, no range to claim.
 */
const KERNEL = /^vn\d/i;

function codeOf(written: unknown): string | undefined {
  if (written === undefined || written === null) return RUN_CODES.VN6002_FAILED;
  const code = String(written);
  return KERNEL.test(code) ? undefined : code;
}

function reservedCode(written: string): VennError {
  return new VennError({
    code: CODES.VN3022_RESERVED_CODE.code,
    message: `"${written}" begins with VN, and those codes belong to the language.`,
    detail: { code: written },
  });
}
