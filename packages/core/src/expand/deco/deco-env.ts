import type { Cell, CellEnv, EvalEnv } from "../../expr/index.js";
import { PRELUDE_VALUES } from "../../expr/index.js";

/**
 * What a decorator body can see: its own parameters, its own `let`s, and the
 * prelude.
 *
 * Nothing else, and deliberately so. The body runs before the program exists: no
 * flow has started and no plugin has been asked for anything, so a name it did
 * not bind itself cannot mean anything yet. The runner says exactly that instead
 * of quietly evaluating to nothing.
 *
 * Bindings are held in cells rather than as plain values, because a hook the
 * body handed out may write one: `let n = 0` beside a `wrap` that counts is how
 * a decorator carries a cooldown. A cell is the same storage a captured `let`
 * has anywhere else, so the write and the read reach one place.
 *
 * The reader is called `place` rather than `cell` on purpose. `hasCells` asks
 * an environment structurally, and a `deco` body that answered it would be
 * resolved when the hook is built: every free name would take an empty cell
 * minted here and never ask the program again. A hook has to reach past this
 * body, so this body must not look like the end of the chain. {@link HookEnv}
 * is the end, and it is the one that answers `cell`.
 */
export class DecoEnv implements EvalEnv {
  private readonly cells = new Map<string, Cell>();

  constructor(bindings: Record<string, unknown>) {
    for (const [name, value] of Object.entries(bindings)) this.cells.set(name, { value });
  }

  lookup(name: string): unknown {
    const held = this.cells.get(name);
    return held ? held.value : PRELUDE_VALUES[name];
  }

  bind(name: string, value: unknown): void {
    this.cells.set(name, { value });
  }

  /** Where this body keeps the name, or nothing when it never bound one. */
  place(name: string): Cell | undefined {
    return this.cells.get(name);
  }
}

/**
 * What a hook can see: the `deco` body it was written in, then the program.
 *
 * A hook is not the body. `target.wrap(fn (call, args) { … })` hands a value
 * over and the value is called once the program is running, by which time a
 * plugin namespace and a prelude verb are as reachable as they are anywhere
 * else. Stopping at the `deco` body left `print` reading as `null` and `io`
 * reported out of reach, both about a moment the hook was not running in.
 *
 * The body wins where both answer, so a hook reads the name its decorator gave
 * it rather than one the program happens to share. `undefined` is what the body
 * says for a name it never bound: the language's own nothing is `null`, so the
 * two are never confused.
 */
export class HookEnv implements CellEnv {
  constructor(
    private readonly body: DecoEnv,
    private readonly program: CellEnv,
  ) {}

  lookup(name: string): unknown {
    const held = this.body.lookup(name);
    return held === undefined ? this.program.lookup(name) : held;
  }

  /**
   * Where a write lands, which is wherever the read came from.
   *
   * A name the decorator bound is the decorator's, and a hook counting in one
   * is the point. Anything else belongs to the program, which is the storage a
   * `let` at the top of the file already has.
   */
  cell(name: string): Cell {
    return this.body.place(name) ?? this.program.cell(name);
  }
}
