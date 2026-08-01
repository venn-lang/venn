import { VennError } from "@venn-lang/contracts";
import { CODES, evaluate, type FragmentDecl, type ParamList, type RunStmt } from "@venn-lang/core";
import { binderFor, createScope, type Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { runBlock } from "./run-block.js";
import { ReturnSignal } from "./signals.js";

/** `run fragment(args) as x`: invoke a fragment and bind its return value. */
export async function runRun(engine: Engine, stmt: RunStmt, scope: Scope): Promise<void> {
  const fragment = engine.fragments.get(stmt.target);
  if (!fragment) throw unknownFragment(stmt.target);
  const args = (stmt.args?.args ?? []).map((arg) => evaluate(arg.value, scope));
  const fragScope = createScope();
  bindParams(fragScope, fragment.params, args);
  const value = await runFragment(engine, fragment, fragScope);
  if (stmt.bind) scope.set(stmt.bind, value);
}

async function runFragment(engine: Engine, fragment: FragmentDecl, scope: Scope): Promise<unknown> {
  try {
    await runBlock(engine, fragment.body, scope);
    return undefined;
  } catch (error) {
    if (error instanceof ReturnSignal) return error.value;
    throw error;
  }
}

function bindParams(scope: Scope, params: ParamList | undefined, args: readonly unknown[]): void {
  (params?.params ?? []).forEach((param, index) => {
    binderFor(param)(args[index], scope);
  });
}

function unknownFragment(name: string): VennError {
  return new VennError({
    code: CODES.VN2005_UNKNOWN_FRAGMENT.code,
    message: `Unknown fragment "${name}".`,
    detail: { fragment: name },
  });
}
