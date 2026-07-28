import { nativeFn } from "../../expr/index.js";
import { AROUND_KEYS, addDecoration } from "../decorations.js";
import type { Verb, VerbTable } from "./handle.types.js";

/** Everything a function's call can be surrounded with. */
export const CALL_AROUND_VERBS: VerbTable = {
  props: {},
  calls: { wrap: around(AROUND_KEYS.wrap), before: before(), after: after() },
};

/**
 * A flow and a step have no `wrap`: there is no call to intercept and no return
 * to replace, only a body that runs. Offering it would be a verb that does
 * nothing, which is worse than not having it.
 */
export const BODY_AROUND_VERBS: VerbTable = {
  props: {},
  calls: { before: before(), after: after() },
};

function before(): Verb {
  return around(AROUND_KEYS.before);
}

function after(): Verb {
  return around(AROUND_KEYS.after);
}

function around(key: string): Verb {
  return (node) =>
    nativeFn((args) => {
      addDecoration(node, key, args[0]);
      return null;
    });
}
