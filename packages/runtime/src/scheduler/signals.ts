// Control-flow signals thrown to unwind loops and fragments. Deliberately not
// Errors, so a `try/catch` in a flow re-throws them instead of treating them as
// failures.

export class BreakSignal {}
export class ContinueSignal {}
export class ReturnSignal {
  constructor(readonly value: unknown) {}
}
/** Thrown at a statement boundary when the branch's race has already been won. */
export class CancelSignal {}
/**
 * Thrown by `exit`, carrying the code the host should leave with.
 *
 * A signal and not an error: a run that exits has not failed. The code it
 * carries is the whole verdict, and `exit 0` is a clean ending, which an error
 * unwinding as a failure could not express.
 */
export class ExitSignal {
  constructor(readonly code: number) {}
}

export type ControlSignal = BreakSignal | ContinueSignal | ReturnSignal | CancelSignal | ExitSignal;

export function isControlSignal(value: unknown): value is ControlSignal {
  return (
    value instanceof BreakSignal ||
    value instanceof ContinueSignal ||
    value instanceof ReturnSignal ||
    value instanceof CancelSignal ||
    value instanceof ExitSignal
  );
}
