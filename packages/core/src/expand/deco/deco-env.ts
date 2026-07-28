import type { EvalEnv } from "../../expr/index.js";
import { PRELUDE_VALUES } from "../../expr/index.js";

/**
 * What a decorator body can see: its own parameters, its own `let`s, and the
 * prelude.
 *
 * Nothing else, and deliberately so. The body runs before the program exists: no
 * flow has started and no plugin has been asked for anything, so a name it did
 * not bind itself cannot mean anything yet. The runner says exactly that instead
 * of quietly evaluating to nothing.
 */
export class DecoEnv implements EvalEnv {
  constructor(private readonly bindings: Record<string, unknown>) {}

  lookup(name: string): unknown {
    if (Object.hasOwn(this.bindings, name)) return this.bindings[name];
    return PRELUDE_VALUES[name];
  }

  bind(name: string, value: unknown): void {
    this.bindings[name] = value;
  }
}
