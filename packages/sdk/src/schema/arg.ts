import type { FnSpec, TypeSpec } from "@venn-lang/types";
import { t } from "@venn-lang/types";
import type { ArgSpec } from "./args.types.js";

/** One required positional argument: `arg("url", t.string, "Where to send it.")`. */
export function arg(name: string, type: TypeSpec, doc?: string): ArgSpec {
  return { name, type, doc };
}

/** The same, for an argument the call still means something without. */
export function optionalArg(name: string, type: TypeSpec, doc?: string): ArgSpec {
  return { name, type, doc, optional: true };
}

/** This argument and every one after it: `data.oneOf a b c`, `print x y z`. */
export function restArg(name: string, type: TypeSpec, doc?: string): ArgSpec {
  return { name, type, doc, rest: true };
}

/**
 * Build the function type a checker reads out of the arguments an author named,
 * so the shape is declared in one place only.
 *
 * A rest argument contributes its own type and no more: `FnSpec` has no way to
 * say "and more like it", and arity is informed rather than policed.
 *
 * @param args The positional arguments, in order.
 * @param result What the call evaluates to. Absent means `dynamic`.
 * @returns The function type.
 */
export function signatureOf(args: readonly ArgSpec[], result: TypeSpec | undefined): FnSpec {
  return t.fn(
    args.map((each) => each.type),
    result ?? t.dynamic,
  );
}
