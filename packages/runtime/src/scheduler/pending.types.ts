/**
 * What a statement leaves behind: nothing, or work still in flight.
 *
 * Most statements are pure evaluation (a `let`, a `return`, a comparison) and an
 * `async` handler would wrap each one in a promise and a microtask. Returning
 * `undefined` when there is nothing to await lets the caller skip that, which is
 * what keeps a loop over 50k items from paying five promises an iteration.
 */
export type Pending = void | Promise<void>;
