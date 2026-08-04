/**
 * Why a block stopped, when it did.
 *
 * Numbers rather than thrown signals: a `break` in a loop of fifty thousand
 * would otherwise build fifty thousand stack traces, and the whole reason a
 * body is compiled is that a call is cheap.
 *
 * In a file of their own so that a step written apart from the walk that runs it
 * can answer in the same words without the two importing each other.
 */

/** The step ran and the block goes on. */
export const RAN = 0;
/** The body returned, so everything above it stops. */
export const LEFT = 1;
/** The innermost loop ends. */
export const BROKE = 2;
/** The innermost loop starts its next pass. */
export const WENT_ON = 3;
