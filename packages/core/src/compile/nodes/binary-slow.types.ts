/**
 * The half of a binary operation that is not two plain numbers, compiled for
 * one node: two values in, a value out.
 */
export type SlowBinary = (left: unknown, right: unknown) => unknown;
