/**
 * Values that have not arrived yet, travelling up an expression.
 *
 * Expressions compile to synchronous functions, so a plugin verb called from
 * inside one hands back the promise it is running on rather than its result.
 * Computing with that promise would quietly produce nonsense, so each node that
 * meets one chains onto it and hands a promise to *its* parent. The statement
 * at the top is already asynchronous and waits there.
 *
 * The effect is that `await` never has to be written: a function reaching for
 * something slow returns something slow, all the way up, and the statement that
 * binds it gets the value. Nothing pays for this until a promise appears, and
 * the checks sit past the fast paths ordinary values take.
 */

/** Whether this value is still on its way. */
export function isWaiting(value: unknown): value is Promise<unknown> {
  return value instanceof Promise;
}

/** Continue once this value has arrived, or immediately if it already has. */
export function whenReady<T>(value: unknown, then: (settled: unknown) => T): T | Promise<T> {
  return isWaiting(value) ? value.then(then) : then(value);
}

/** The same for a pair, without building an array when neither is waiting. */
export function whenBothReady<T>(
  left: unknown,
  right: unknown,
  then: (a: unknown, b: unknown) => T,
): T | Promise<T> {
  if (!isWaiting(left) && !isWaiting(right)) return then(left, right);
  return Promise.all([left, right]).then(([a, b]) => then(a, b));
}

/** The same for a list: `Promise.all` only when one of them is waiting. */
export function whenAllReady<T>(
  values: readonly unknown[],
  then: (settled: unknown[]) => T,
): T | Promise<T> {
  // An index loop, not `for…of`: this runs once per call and the iterator a
  // `for…of` allocates showed up as 25% on a call-heavy program.
  for (let at = 0; at < values.length; at += 1) {
    if (isWaiting(values[at])) return Promise.all(values).then(then);
  }
  return then(values as unknown[]);
}
