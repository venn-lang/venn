/**
 * What the grammar says about itself, asked at run time instead of copied.
 *
 * To tell somebody a separator is missing, a message has to know two things:
 * what goes between two items, and what an item may begin with. Both are
 * already written in `venn.langium`. Writing them out again here as a list of
 * keywords is exactly how the reserved-word set came to exist six times over
 * with three of the copies wrong, so nothing is written out: the generated
 * grammar is walked and asked, and a word added to the language reaches these
 * answers the moment `generated/` is rebuilt.
 */

import { GrammarAST as ast } from "langium";
import { VennGrammar } from "../generated/grammar.js";
import type { SeparatedList } from "./grammar-shape.types.js";

/** The token a newline is, which is also what a `;` lexes as. */
export const NEWLINE = "NL";

/** The other separator, the one the map-shaped lists and the bracketed ones take. */
export const COMMA = ",";

/** Every rule of the language, by the name it was written under. */
let byName: Map<string, ast.AbstractRule> | undefined;

/** Every token each rule may begin with, once the fixed point has settled. */
let firsts: Map<string, Set<string>> | undefined;

/**
 * The list a rule writes as items with a mandatory separator between them.
 *
 * @param rule The rule's name, as Chevrotain reports it.
 * @returns What goes between two items and what an item starts with, or
 * nothing when the rule holds no such list.
 */
export function separatedListIn(rule: string): SeparatedList | undefined {
  const named = ruleNamed(rule);
  if (!named || !ast.isParserRule(named)) return undefined;
  for (const element of walk(named.definition)) {
    const found = ast.isGroup(element) ? repeated(element) : undefined;
    if (found) return found;
  }
  return undefined;
}

/**
 * Whether a rule is shaped `… (opts=MapLit)? body=Block`, which is what makes a
 * single trailing brace after it the writer's mistake and never the grammar's.
 *
 * @param rule The rule's name, as Chevrotain reports it.
 */
export function takesOptionsThenBody(rule: string): boolean {
  const filled = [...assignments(rule)].map((one) => ({
    optional: one.cardinality === "?",
    rule: ast.isRuleCall(one.terminal) ? one.terminal.rule.$refText : "",
  }));
  const options = filled.some((one) => one.optional && one.rule === "MapLit");
  return options && filled.some((one) => one.rule === "Block");
}

/**
 * The word a rule begins with, which is what a reader calls the construct.
 *
 * @param rule The rule's name, as Chevrotain reports it.
 * @returns The keyword, or nothing when the rule opens with something else.
 */
export function leadKeywordIn(rule: string): string | undefined {
  const named = ruleNamed(rule);
  if (!named || !ast.isParserRule(named)) return undefined;
  return leadOf(named.definition);
}

/**
 * A rule's name as it was written, with Chevrotain's marking taken off.
 *
 * Langium marks each rule with a zero-width space so no rule can collide with a
 * name of Chevrotain's own, and that mark reaches every rule stack a parse
 * error carries. It is not part of the name anybody wrote.
 *
 * @param name The name as Chevrotain reports it.
 */
export function ruleWritten(name: string): string {
  return name.replace(/\W/g, "");
}

function ruleNamed(name: string): ast.AbstractRule | undefined {
  byName ??= new Map(VennGrammar().rules.map((rule) => [rule.name, rule]));
  return byName.get(ruleWritten(name));
}

/** Every assignment a rule makes, wherever in it the assignment sits. */
function* assignments(rule: string): Generator<ast.Assignment> {
  const named = ruleNamed(rule);
  if (!named || !ast.isParserRule(named)) return;
  for (const element of walk(named.definition)) {
    if (ast.isAssignment(element)) yield element;
  }
}

/**
 * A `(separator item)*` or an `(item separator)*`, which is how every list in
 * this grammar is written, and what stands between two items either way.
 *
 * The separator has to be one the writer cannot leave out. An annotation loop
 * is spelled `(annotations+=Annotation NL*)*`, the same two elements with an
 * optional newline, and it is a repetition of one thing rather than a list of
 * several, so a missing newline there is not a missing separator.
 */
function repeated(group: ast.Group): SeparatedList | undefined {
  const [first, second] = group.elements;
  const repeats = group.cardinality === "*" || group.cardinality === "+";
  if (!repeats || group.elements.length !== 2) return undefined;
  if (!first || !second) return undefined;
  const item = ast.isAssignment(first) ? first : ast.isAssignment(second) ? second : undefined;
  const between = item === first ? second : first;
  if (!item || ast.isAssignment(between)) return undefined;
  if (between.cardinality === "*" || between.cardinality === "?") return undefined;
  const table = firstTable();
  const separators = firstOf(between, table);
  return { closer: closerOf(group), separators, starts: firstOf(item.terminal, table) };
}

/**
 * The keyword the list is closed by, found by climbing out of the repetition.
 *
 * The repetition sits inside whatever group the rule wrapped it in, and the
 * closer is the last thing that group's own group ends with: `Block` reaches
 * `}` two levels up, and `Document` reaches the rule itself and so has none.
 */
function closerOf(group: ast.Group): string | undefined {
  let node = group.$container;
  while (node) {
    const last = ast.isGroup(node) ? node.elements.at(-1) : undefined;
    if (last && ast.isKeyword(last)) return last.value;
    node = node.$container;
  }
  return undefined;
}

/** The keyword a rule opens with, reading past whatever may be left out first. */
function leadOf(element: ast.AbstractElement): string | undefined {
  if (ast.isKeyword(element)) return element.value;
  if (!ast.isGroup(element)) return undefined;
  for (const child of element.elements) {
    const found = leadOf(child);
    if (found) return found;
    if (!optional(child)) return undefined;
  }
  return undefined;
}

/** Every token each rule may begin with, computed once on the first question. */
function firstTable(): Map<string, Set<string>> {
  if (firsts) return firsts;
  const table = seeded();
  // Repeated until nothing grows: a rule's answer depends on the rules it
  // reaches, so one pass leaves the tail of every chain short. The fixed point
  // is cheaper to write and to read than the order the rules depend on in.
  let growing = true;
  while (growing) growing = grew(table);
  firsts = table;
  return table;
}

/** One pass over every rule, answering whether any rule's answer got bigger. */
function grew(table: Map<string, Set<string>>): boolean {
  let growing = false;
  for (const rule of VennGrammar().rules) {
    if (!ast.isParserRule(rule)) continue;
    const into = table.get(rule.name);
    if (into && absorb(into, firstOf(rule.definition, table))) growing = true;
  }
  return growing;
}

/** A terminal begins with the token it is; a parser rule starts empty and grows. */
function seeded(): Map<string, Set<string>> {
  return new Map(
    VennGrammar().rules.map((rule) => [
      rule.name,
      ast.isTerminalRule(rule) ? new Set([rule.name]) : new Set<string>(),
    ]),
  );
}

function absorb(into: Set<string>, from: Iterable<string>): boolean {
  const before = into.size;
  for (const token of from) into.add(token);
  return into.size > before;
}

/** Every token an element may begin with, given what is known of the rules. */
function firstOf(element: ast.AbstractElement, table: Map<string, Set<string>>): Set<string> {
  if (ast.isKeyword(element)) return new Set([element.value]);
  if (ast.isRuleCall(element)) return new Set(table.get(element.rule.$refText) ?? []);
  if (ast.isAssignment(element)) return firstOf(element.terminal, table);
  if (ast.isGroup(element)) return firstOfGroup(element, table);
  if (ast.isAlternatives(element) || ast.isUnorderedGroup(element)) {
    return firstOfEach(element.elements, table);
  }
  // An `{infer X}` action rewrites the tree and consumes nothing, so it adds no
  // token. Nothing else here reaches a parser rule.
  return new Set<string>();
}

/** A group starts with its first element, and with the next when that may be left out. */
function firstOfGroup(group: ast.Group, table: Map<string, Set<string>>): Set<string> {
  const found = new Set<string>();
  for (const element of group.elements) {
    absorb(found, firstOf(element, table));
    if (!optional(element)) break;
  }
  return found;
}

function firstOfEach(
  elements: readonly ast.AbstractElement[],
  table: Map<string, Set<string>>,
): Set<string> {
  const found = new Set<string>();
  for (const element of elements) absorb(found, firstOf(element, table));
  return found;
}

/** Whether the grammar lets this element be left out, so the next one may start. */
function optional(element: ast.AbstractElement): boolean {
  return element.cardinality === "?" || element.cardinality === "*" || ast.isAction(element);
}

/** Every element of a rule, outermost first, since a list may sit at any depth. */
function* walk(element: ast.AbstractElement): Generator<ast.AbstractElement> {
  yield element;
  if (ast.isAssignment(element)) yield* walk(element.terminal);
  if (ast.isGroup(element) || ast.isAlternatives(element) || ast.isUnorderedGroup(element)) {
    for (const child of element.elements) yield* walk(child);
  }
}
