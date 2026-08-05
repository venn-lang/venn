import { buildProblem, CODES } from "../../codes/index.js";
import type { DecoDecl } from "../../generated/ast.js";
import type { Problem } from "../../problem/index.js";
import { spanOf } from "../../span/index.js";
import type { DecoratorDefinition, ExpandContext } from "../expand.types.js";
import { makeHandle, targetKindOf } from "../handles/index.js";
import type { DecoSignature } from "./deco.types.js";
import { DecoEnv } from "./deco-env.js";
import { namesOutOfReach } from "./reach/index.js";
import { readSignature } from "./read-signature.js";
import { runDecoBody } from "./run-body.js";

/** A `deco` and everything reporting about it needs. */
interface DecoArgs {
  decl: DecoDecl;
  uri: string;
  problems: Problem[];
}

/**
 * A `deco` written in the language, as a decorator the expansion phase applies.
 *
 * This is the very {@link DecoratorDefinition} a plugin's TypeScript
 * `defineDecorator` produces: one mechanism, two doors. What the signature says
 * it decorates becomes `accepts`, so the type error for `@memoize` on a flow
 * comes from how the author wrote the parameters rather than from a list kept by
 * hand beside them.
 *
 * What the body reaches for is settled here too, before it is ever run: a name
 * expansion time cannot bind is refused where it is written rather than read as
 * nothing and carried into the program.
 *
 * @returns a definition that does nothing when the signature does not read. The
 * reason is pushed onto `args.problems` once, here, rather than at every use.
 */
export function decoDecorator(args: DecoArgs): DecoratorDefinition {
  args.problems.push(...namesOutOfReach(args));
  const read = readSignature(args.decl);
  if (read.ok) return definition({ ...args, sig: read.signature });
  args.problems.push(signatureProblem(args, read.title));
  // Still resolvable, doing nothing: a fault committed once, where the `deco` is
  // written, must not be repeated at every use of it.
  return { name: args.decl.name, expand: () => {} };
}

function definition(args: DecoArgs & { sig: DecoSignature }): DecoratorDefinition {
  return {
    name: args.decl.name,
    accepts: args.sig.kinds,
    expand: (ctx) => apply({ ...args, ctx }),
  };
}

function apply(args: DecoArgs & { sig: DecoSignature; ctx: ExpandContext }): void {
  const handle = makeHandle({ node: args.ctx.node, kind: targetKindOf(args.ctx.node) });
  runDecoBody({
    body: args.decl.body,
    env: new DecoEnv(bindings(args.sig, handle, args.ctx.args)),
    uri: args.uri,
    reject: (problem) => args.problems.push(problem),
  });
}

/** The target under the name the body calls it by, then `@name(…)` in order. */
function bindings(
  sig: DecoSignature,
  handle: unknown,
  given: readonly unknown[],
): Record<string, unknown> {
  const bound: Record<string, unknown> = { [sig.target]: handle };
  sig.args.forEach((name, at) => {
    bound[name] = given[at];
  });
  return bound;
}

function signatureProblem(args: DecoArgs, title: string): Problem {
  return buildProblem({
    spec: CODES.VN2015_DECO_SIGNATURE,
    span: spanOf(args.decl, args.uri),
    title,
  });
}
