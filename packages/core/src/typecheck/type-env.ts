import { freeVars, type Scheme } from "./scheme.js";

/**
 * The names in scope during inference, mapped to their type schemes. Chained, so
 * a function body sees the outer scope. Names it does not know resolve to
 * `dynamic` at the use site: the type checker only ever settles type
 * consistency, never name resolution, which is the runtime's static check.
 */
export interface TypeEnv {
  lookup(name: string): Scheme | undefined;
  with(name: string, scheme: Scheme): TypeEnv;
  /** Ids of the variables free across every binding: what must not generalise. */
  freeVars(): Set<number>;
}

export function emptyEnv(): TypeEnv {
  return envOf(new Map(), undefined);
}

function envOf(bindings: Map<string, Scheme>, parent: TypeEnv | undefined): TypeEnv {
  return {
    lookup: (name) => bindings.get(name) ?? parent?.lookup(name),
    with(name, scheme) {
      return envOf(new Map([[name, scheme]]), this);
    },
    freeVars() {
      const free = parent ? parent.freeVars() : new Set<number>();
      for (const scheme of bindings.values()) collect(scheme, free);
      return free;
    },
  };
}

/** A binding's contribution to the environment's free variables: the ones it did
 * not quantify. */
function collect(scheme: Scheme, into: Set<number>): void {
  const quantified = new Set(scheme.quantified);
  for (const id of freeVars(scheme.type)) if (!quantified.has(id)) into.add(id);
}

/** Extend an environment with several bindings at once. */
export function withAll(env: TypeEnv, bindings: Iterable<[string, Scheme]>): TypeEnv {
  let next = env;
  for (const [name, scheme] of bindings) next = next.with(name, scheme);
  return next;
}
