/**
 * The way out of a member nothing answers to.
 *
 * VN3010 knew the receiver's whole member table and printed none of it:
 * `xs.lenght` is one letter from `len` and was answered with silence, while
 * VN2003 had been offering ``Did you mean `io.readLine`?`` for verbs since the
 * suggester was written. The search is the same search, imported rather than
 * written again.
 *
 * Two answers, and the certain one goes first. A name that exists on a
 * neighbouring type is not a typo: `"a".concat("b")` is spelled perfectly and
 * `concat` is on a list, so naming where it lives beats guessing at what else
 * it could have been. Only when nothing owns the name is a near-miss offered.
 */

import { didYouMean, nearestName } from "../suggest/index.js";
import { CHECKED_MEMBERS } from "./builtins.js";
import { baseOf, type Type } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * What to say under `Type list<number> has no member "lenght".`
 *
 * @param receiver The type read from, pruned or not.
 * @param name The member written.
 * @returns The help line, or nothing when neither answer is available, since a
 * guess nobody can stand behind is worse than the title alone.
 */
export function memberHelp(receiver: Type, name: string): string | undefined {
  const type = prune(receiver);
  const kind = kindOfType(type);
  if (kind === undefined) return undefined;
  const answers = [...answersTo(type, kind)];
  return livesOn(kind, name) ?? nearMiss(answers, name) ?? theLongName(answers, name);
}

/**
 * Where the name does live, when it lives somewhere.
 *
 * @returns The sentence naming the type that has it, or nothing when no built-in
 * type does.
 */
function livesOn(kind: string, name: string): string | undefined {
  const owner = Object.keys(CHECKED_MEMBERS).find(
    (other) => other !== kind && tableOf(other).includes(name),
  );
  if (owner === undefined) return undefined;
  return `\`${name}\` is a member of ${article(owner)}, not of ${article(kind)}.`;
}

/** The nearest spelling the receiver does answer to. */
function nearMiss(candidates: Iterable<string>, name: string): string | undefined {
  const near = nearestName(name, candidates);
  return near === undefined ? undefined : didYouMean(near);
}

/**
 * The member whose whole name is how this one starts.
 *
 * `xs.length` and `xs.lenght` are both three edits from `len` on a six-letter
 * word, which is exactly the half the search refuses, and refusing is right of
 * it: two names that differ by half of themselves are usually two names. But
 * this is not a typo. It is the longer word for the same idea, carried in from
 * a language that spells it out, and `len` being the whole of how `length`
 * begins is what says so. The longest such prefix wins, so `toNumberOfDays` is
 * offered `toNumber` and never `to`.
 */
function theLongName(candidates: readonly string[], name: string): string | undefined {
  const starts = candidates.filter(
    (member) => member.length >= SHORTEST && member.length < name.length && name.startsWith(member),
  );
  const longest = starts.sort((a, b) => b.length - a.length)[0];
  return longest === undefined ? undefined : didYouMean(longest);
}

/** Below three letters a prefix is a coincidence rather than a word. */
const SHORTEST = 3;

/** A built-in member table, by the name the tables are filed under. */
function tableOf(kind: string): readonly string[] {
  return CHECKED_MEMBERS[kind] ?? [];
}

/**
 * Everything this receiver does answer to.
 *
 * A shape answers to its own fields as well as to what every map answers to,
 * and a handle answers to what it published and to nothing else.
 */
function answersTo(type: Type, kind: string): Iterable<string> {
  if (type.kind === "record") return [...type.fields.keys(), ...tableOf("map")];
  if (type.kind === "opaque") return type.members?.keys() ?? [];
  return tableOf(kind);
}

/**
 * Which table answers for a receiver.
 *
 * A literal is one value of its type and answers to what that type answers to,
 * which is why `"GET".uppr` is offered `upper` rather than nothing.
 */
function kindOfType(receiver: Type): string | undefined {
  if (receiver.kind === "list") return "list";
  if (receiver.kind === "record") return "map";
  if (receiver.kind === "prim" || receiver.kind === "opaque") return receiver.name;
  return receiver.kind === "literal" ? baseOf(receiver.value) : undefined;
}

/** `a list`, `an instant`: the word as it reads in the middle of a sentence. */
function article(kind: string): string {
  return `${"aeiou".includes(kind[0] as string) ? "an" : "a"} ${kind}`;
}
