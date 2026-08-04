import type { Problem } from "./problem.types.js";
import type { Span } from "./span.types.js";

/**
 * What a thrown value may be carrying, whoever threw it.
 *
 * The kernel cannot name the classes: `ProblemError` is its own, but a
 * `VennError` belongs to `@venn-lang/contracts`, which core does not depend on,
 * and every plugin raises one of those. So the contract is structural, and this
 * is where it is written down rather than guessed at twice.
 */
export interface Thrown {
  message?: string;
  code?: string;
  problem?: Problem;
  detail?: { data?: unknown; where?: Span };
}
