/**
 * `error`, what a `catch` binds, as the checker holds it.
 *
 * The shape is published by `@venn-lang/prelude`, with everything else that
 * comes native. Opaque rather than a record, for the same reason `regex` is:
 * what a failure publishes is settled, and a program reading `e.nowhere` should
 * hear about it where it is written rather than at three in the morning.
 *
 * What it was before is two fields built by a three-line function, bound as
 * `dynamic`. Everything the failure knew, where it happened, what would help,
 * what the docs say, was rendered to a terminal and thrown away before the
 * program that caught it could see any of it.
 */

import { PRELUDE_TYPES } from "@venn-lang/prelude";
import { specToType } from "./spec-to-type.js";
import { DYNAMIC, type Type } from "./type.types.js";

export const ERROR_TYPE: Type = specToType(PRELUDE_TYPES.error ?? DYNAMIC, () => undefined);
