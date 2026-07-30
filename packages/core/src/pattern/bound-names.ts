import type { ForEachStmt, Pattern } from "../generated/ast.js";
import { patternNames } from "./pattern-slots.js";

/**
 * Anything that puts a value in scope: a `let`, a parameter, a loop variable.
 * Written as one name or as a pattern, and everything downstream of it treats
 * the two the same way.
 */
export interface BindsValue {
  readonly name?: string;
  readonly pattern?: Pattern;
}

/**
 * The names a binding site puts in scope: its own, or every one its pattern
 * takes apart.
 *
 * @param site A `let`, a parameter, or the variable of a loop.
 * @returns One name, several, or none when a half-written one has neither.
 */
export function boundNames(site: BindsValue): string[] {
  if (site.name) return [site.name];
  return site.pattern ? patternNames(site.pattern) : [];
}

/** A `forEach`'s variable as a binding site, since it spells its name `item`. */
export function loopBinding(stmt: ForEachStmt): BindsValue {
  return { name: stmt.item, pattern: stmt.pattern };
}
