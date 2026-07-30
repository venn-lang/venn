import { evaluate, isContinueStmt, type LoopStmt, type Statement, truthy } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import { planOf } from "./block-plan.js";
import type { Engine } from "./engine.types.js";
import type { Pending } from "./pending.types.js";
import { runSteps } from "./run-block.js";
import { isPending, settle } from "./settled.js";
import { BreakSignal, ContinueSignal } from "./signals.js";

/**
 * `loop { … }`, `loop cond { … }`, `loop state = initial { … }`.
 *
 * One word for every loop whose end is not known in advance. It runs until
 * `break`, or until the condition stops holding, and nothing caps it: a program
 * that means to run forever, a game among them, is allowed to. What ends a run
 * that should have ended is the timeout on the step or the flow around it, which
 * is what the language already promises.
 *
 * `continue next` starts the following pass with `next` bound to the state name,
 * so a value crosses the boundary without anything being assigned: each pass
 * binds the name once, and after the loop the name holds what the last pass
 * left.
 *
 * Synchronous until something actually suspends, which is the shape `forEach`
 * already uses. Awaiting once per pass costs a microtask per pass: written that
 * way first, 50,000 passes took 29 ms instead of 1.2 ms.
 */
export function runLoop(engine: Engine, stmt: LoopStmt, scope: Scope): Pending {
  const state = new LoopState(engine, stmt, scope);
  return state.drive();
}

/**
 * One loop in flight.
 *
 * A class rather than a closure because a pass that suspends has to resume with
 * everything the loop knew: the carried value above all, which is the one thing
 * a plain recursive helper would have to thread through by hand.
 */
class LoopState {
  private readonly steps: readonly unknown[];
  /**
   * The `continue` the body ends with, if it does.
   *
   * `continue next` on the last line is how the idiomatic loop advances, and
   * running it as a statement means throwing a signal on every single pass.
   * Fifty thousand throws cost 23 of the 24 ms this loop used to take. Taken off
   * the plan and evaluated here instead, the common shape pays nothing, and a
   * `continue` anywhere else still unwinds the way a jump has to.
   */
  private readonly tail: Statement | undefined;
  private readonly name: string | undefined;
  /** One child scope for the whole loop, rewritten per pass rather than rebuilt. */
  private readonly child: Scope;
  private carried: unknown;

  constructor(
    private readonly engine: Engine,
    private readonly stmt: LoopStmt,
    private readonly scope: Scope,
  ) {
    const stmts = stmt.body.stmts;
    const last = stmts[stmts.length - 1];
    this.tail = last && isContinueStmt(last) && last.value ? last : undefined;
    const steps = planOf(stmt.body).steps;
    this.steps = this.tail ? steps.slice(0, -1) : steps;
    this.name = stmt.state?.name;
    this.child = scope.child();
    this.carried = stmt.state ? evaluate(stmt.state.initial, scope) : undefined;
  }

  /**
   * Passes, synchronously, until one suspends. From there a second loop takes
   * over that awaits, so a program that never suspends never touches a promise
   * and one that does is not recursing through them.
   */
  drive(): Pending {
    if (isPending(this.carried)) return this.driveAwaiting();
    while (true) {
      const holds = this.holds();
      if (isPending(holds)) return this.driveAwaiting(holds as Promise<boolean>);
      if (!holds) return this.finish();
      const pass = this.onePass();
      if (pass === STOP) return this.finish();
      if (pass !== CARRY_ON) return this.driveAwaiting(undefined, pass as Promise<unknown>);
    }
  }

  /**
   * The same loop, awaiting. Entered with whatever was already in flight: the
   * initial value, the condition, or the pass that suspended.
   */
  private async driveAwaiting(holds?: Promise<boolean>, pass?: Promise<unknown>): Promise<void> {
    this.carried = await settle(this.carried);
    if (holds && !(await holds)) return this.finish();
    if (pass && (await this.settlePass(pass)) === STOP) return this.finish();
    while (await this.holds()) {
      if ((await this.settlePass(this.onePass())) === STOP) return this.finish();
    }
    return this.finish();
  }

  /** The condition, or `true` when there is none, which is what `loop` means. */
  private holds(): boolean | Promise<boolean> {
    if (this.engine.signal?.aborted) return false;
    if (!this.stmt.cond) return true;
    const value = evaluate(this.stmt.cond, this.scope);
    return isPending(value) ? settle(value).then(truthy) : truthy(value);
  }

  /**
   * One pass: `CARRY_ON` when it ran through, `STOP` on `break`, or the promise
   * it suspended on.
   */
  private onePass(): unknown {
    if (this.name) this.child.set(this.name, this.carried);
    try {
      const pending = runSteps(this.engine, this.steps as never, this.child);
      if (pending) return pending;
      this.advance();
      return CARRY_ON;
    } catch (error) {
      return this.fromSignal(error);
    }
  }

  /** What a pass ended as, waiting for it first when it had suspended. */
  private async settlePass(pass: unknown): Promise<symbol> {
    if (pass === STOP || pass === CARRY_ON) return pass as symbol;
    try {
      await pass;
      this.advance();
      return CARRY_ON;
    } catch (error) {
      return this.fromSignal(error) as symbol;
    }
  }

  /** The trailing `continue`, run without a signal because nothing is jumping. */
  private advance(): void {
    const value = (this.tail as { value?: unknown })?.value;
    if (value) this.carried = evaluate(value as never, this.child);
  }

  /** `break` ends the loop; `continue` sets what the next pass starts from. */
  private fromSignal(error: unknown): unknown {
    if (error instanceof BreakSignal) return STOP;
    if (error instanceof ContinueSignal) {
      if (error.value !== undefined) this.carried = error.value;
      return CARRY_ON;
    }
    throw error;
  }

  /** The state outlives the loop, so a running total can be read after it. */
  private finish(): undefined {
    if (this.name) this.scope.set(this.name, this.carried);
    return undefined;
  }
}

/** Sentinels, so a pass's outcome needs no object allocated per pass. */
const CARRY_ON = Symbol("carry on");
const STOP = Symbol("stop");
