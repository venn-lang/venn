/**
 * `"a"`, or `"a" or "b"`, or `"a", "b" or "c"`: a list a person would read out.
 *
 * Three titles built this phrase for themselves, two of them character for
 * character, doc comment included: the parser naming what could have gone here,
 * the `if` chain naming the cases it does not cover, and the `match` naming
 * hers. What each of them lists is its own business, and how the list is said
 * is one sentence in the product's voice, so it is said here.
 *
 * @param all The items, already rendered and in the order to read them.
 * @returns The phrase, with no trailing full stop and no serial comma before
 * `or`. Empty for no items, which no caller asks for: nothing to list is
 * nothing to say.
 */
export function orPhrase(all: readonly string[]): string {
  const last = all[all.length - 1] ?? "";
  return all.length === 1 ? last : `${all.slice(0, -1).join(", ")} or ${last}`;
}
