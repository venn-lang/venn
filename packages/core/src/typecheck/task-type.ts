/**
 * `task`, what `spawn` hands back, as the checker holds it.
 *
 * The shape is published by `@venn-lang/prelude`, with everything else that
 * comes native. Opaque rather than a record, for the same reason `regex` is:
 * the promise inside is deliberately out of reach, and the four verbs it
 * publishes are the whole of what one offers.
 *
 * Before this, `spawn` answered `dynamic`, so `job.dnoe` was silent and the
 * editor offered nothing after the dot, while the runtime had known all four
 * members all along.
 */

import { PRELUDE_TYPES } from "@venn-lang/prelude";
import { specToType } from "./spec-to-type.js";
import { DYNAMIC, type Type } from "./type.types.js";

export const TASK_TYPE: Type = specToType(PRELUDE_TYPES.task ?? DYNAMIC, () => undefined);
