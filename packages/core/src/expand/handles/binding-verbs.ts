import { constLit } from "../../compile/index.js";
import { evaluate, nativeFn } from "../../expr/index.js";
import type { LetStmt } from "../../generated/ast.js";
import type { VerbTable } from "./handle.types.js";

/** Nothing is bound yet, so what a binding's value refers to is nothing either. */
const NOTHING = { lookup: () => undefined };

/**
 * A `let` or `const`: what it was bound to, and binding it to something else.
 *
 * `.value` reads the expression as written, against an empty scope. Expansion
 * happens before any of the program's own names exist, so a binding whose value
 * depends on one answers with nothing rather than with a guess.
 */
export const BINDING_VERBS: VerbTable = {
  props: { value: (node) => evaluate((node as LetStmt).value, NOTHING) },
  calls: { setValue: (node) => nativeFn((args) => setValue(node as LetStmt, args[0])) },
};

function setValue(stmt: LetStmt, value: unknown): null {
  const written = constLit(value) as { $container?: object; $containerProperty?: string };
  written.$container = stmt;
  written.$containerProperty = "value";
  stmt.value = written as LetStmt["value"];
  return null;
}
