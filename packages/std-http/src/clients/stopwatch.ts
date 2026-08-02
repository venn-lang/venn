/**
 * The one clock both HttpClient implementations read, so `res.time` means the
 * same thing whichever of them answered.
 *
 * `performance.now()` and not `Date.now()`: it is monotonic, so a request that
 * straddles a clock adjustment cannot come back having taken a negative amount
 * of time.
 */

/**
 * Start timing one request.
 *
 * @returns A function giving the whole milliseconds since this call, which is
 * what a response's `time` holds.
 */
export function startStopwatch(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}
