import { CODES } from "../codes/index.js";
import type { Param, RunStmt } from "../generated/ast.js";
import { eachFits } from "./call-arguments.js";
// Type-only, so the cycle with `infer.ts` is erased at build.
import type { Infer } from "./infer.js";
import { paramType } from "./param-type.js";
import { DYNAMIC, type Type } from "./type.types.js";

/**
 * `run show(x)` against what `show` takes.
 *
 * A `fn` called with the wrong type has been refused for as long as there have
 * been types. A `fragment` was not: `run` handed over whatever it was given and
 * the parameter's annotation was read by nobody, so the one construct written to
 * be called from elsewhere was the one nothing checked.
 *
 * A fragment this file does not declare is left alone. One imported from
 * another file is resolved by the runtime, not here, and a name nobody declares
 * at all is `VN2005`, which is a different thing to be told.
 */
export function checkRunArguments(args: {
  node: RunStmt;
  given: readonly Type[];
  infer: Infer;
}): void {
  const fragment = args.infer.fragments?.get(args.node.target);
  if (!fragment) return;
  const params = fragment.params?.params ?? [];
  const written = (args.node.args?.args ?? []).map((arg) => arg.value);
  if (written.length !== params.length) {
    countIsWrong({ ...args, takes: params.length, given: written.length });
    return;
  }
  const wanted = params.map((param: Param) => paramType(param, args.infer));
  eachFits({ written, given: args.given, wanted, infer: args.infer });
}

/**
 * Too few or too many, which is the other thing nobody was checking.
 *
 * Under the same code and in the same words as a call with the wrong number of
 * arguments, because it is the same fact about a different callable.
 */
function countIsWrong(args: { node: RunStmt; infer: Infer; takes: number; given: number }): void {
  args.infer.ctx.mismatches.push({
    node: args.node,
    expected: DYNAMIC,
    actual: DYNAMIC,
    code: CODES.VN3002_ARGUMENT_COUNT,
    sentence: `\`${args.node.target}\` takes ${count(args.takes)}, and got ${args.given}.`,
  });
}

function count(many: number): string {
  if (many === 0) return "no arguments";
  return many === 1 ? "1 argument" : `${many} arguments`;
}
