/**
 * `regex`, one of the kernel's own types, as the checker holds it.
 *
 * The shape itself is published by `@venn-lang/prelude`, with everything else
 * that comes native. Opaque rather than a record: how a pattern is held is none
 * of a program's business, and the four members it publishes are the whole of
 * what one offers.
 *
 * The alternative was leaving a pattern as text, which is what it was: then a
 * binding holding one carries a string's members, a `~=` in a loop recompiles on
 * every pass, and a pattern that does not compile can only be found by running
 * the line.
 */

import { PRELUDE_TYPES } from "@venn-lang/prelude";
import { specToType } from "./spec-to-type.js";
import { DYNAMIC, type Type } from "./type.types.js";

export const REGEX_TYPE: Type = specToType(PRELUDE_TYPES.regex ?? DYNAMIC, () => undefined);
