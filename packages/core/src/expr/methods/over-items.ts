import { type Invoke, type Method, nativeFn } from "../native.types.js";
import { whenAllReady } from "../pending.js";
import type { Decide } from "./over-items.types.js";

/**
 * A list method whose callback runs once per item, answering from the results
 * of every item at once.
 *
 * A callback reaching for something slow hands back the promise it is running
 * on rather than a result, and a verb that read that promise as a value would
 * file a group under `[object Promise]` or keep every item its filter was
 * meant to drop. So the results are gathered and the answer is decided from
 * them once they are all in, which is also why the deciding half never sees a
 * promise and reads like the loop it always was.
 *
 * `whenAllReady` builds nothing when every result arrived at once, so the
 * ordinary case is the one array `map` allocated anyway plus the walk over it.
 */
export function perItem(decide: Decide): Method {
  return (list: readonly unknown[], invoke: Invoke) =>
    nativeFn((args) =>
      whenAllReady(
        list.map((item, index) => invoke.two(args[0], item, index)),
        (results) => decide(list, results),
      ),
    );
}
