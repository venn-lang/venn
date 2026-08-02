import { VennError } from "@venn-lang/contracts";
import { CODES, type Span } from "@venn-lang/core";
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
  return new VennError({
    code,
    message: args.message || "fail",
    // Where it was raised, which the runtime knows and a `VennError` has
    // nowhere else to put: it carries a code and a message and no span.
    detail: { data: args.opts.data ?? null, where: args.where },
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
