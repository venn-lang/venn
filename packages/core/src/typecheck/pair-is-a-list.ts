/**
 * The way out of the mistake this language invites and no other spelling warns
 * about: reading a pair by name.
 *
 * `entries`, `zip` and `pairwise` all hand their pairs back as two-item lists,
 * because a list is one type throughout and a key beside a value is two. Every
 * other language the reader has met answers with a record here, so
 * `e => -e.value` is the first thing anybody writes. Until the checker walked
 * into a lambda it was accepted, and `-nothing` is `NaN`, and sorting by `NaN`
 * moves nothing: the report came out ordered by nothing at all, in silence.
 *
 * Naming the two types does not reach that reader. Their mistake is about what
 * a pair is, not about which two types failed to meet.
 */

import { receiverAsWritten } from "./as-written.js";
import type { MemberRead } from "./member-read.types.js";
import type { Type } from "./type.types.js";

/**
 * Where the pairs come from, and what each position holds when they do.
 *
 * Said as a fact about those three members rather than as a claim about the
 * value in hand. The checker knows the element type and not the length: a
 * `list<number>` may be a pair or a row of six, and there is no tuple here to
 * tell them apart. Asserting "this is a two-item list" made the sentence false
 * for `[[1, 2, 3]].map(r => r.value)`, which is the same over-claiming this
 * slice removed from a positional read.
 */
const SOURCES =
  "`entries`, `zip` and `pairwise` all hand back pairs this way, so a key is `[0]` and its value is `[1]`.";

/**
 * What to say when a member was read by name off a list.
 *
 * @param receiver The pruned type that was read, whatever kind it turned out to
 * be. Only a list is read by position.
 * @param read Which member, and the node it was written at, so the receiver can
 * be quoted back as the reader spelled it.
 * @returns The way out, or nothing when this is not that mistake and the other
 * help lines on this code should have their turn.
 */
export function pairIsAList(receiver: Type, read: MemberRead): string | undefined {
  // Only these two names. Any other on a list is an ordinary unknown member,
  // and a paragraph about keys and values would answer a question nobody asked.
  if (receiver.kind !== "list") return undefined;
  if (read.name !== "key" && read.name !== "value") return undefined;
  const it = receiverAsWritten(read);
  const how = it ? `\`${it}[0]\`, \`${it}[1]\`, and so on` : "by position, from `[0]`";
  return `A list is read by position, not by name: ${how}. ${SOURCES}`;
}
