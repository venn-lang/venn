import {
  type AstNode,
  CODES,
  type Expr,
  isActionCall,
  isCall,
  isLetStmt,
  isMatcherClause,
  isRef,
  type Problem,
  type Ref,
} from "@venn-lang/core";
import { PRELUDE } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { problemAt } from "./problem-at.js";

/**
 * The keywords `RefName` admits as values, which name the run rather than a
 * verb: `matrix.browser`, `@scope(flow)`, `step`. `env` joins them because the
 * host binds it before anything is imported. None of them is a mistake here,
 * and `checkUnbound` excuses the same four for the same reason.
 */
const OF_THE_RUN = new Set(["matrix", "flow", "step", "env"]);

/** A bare name in an argument slot, and whether another argument came after it. */
interface BareArg {
  ref: Ref;
  /** True when an argument follows, which is the evidence a statement was eaten. */
  swallowed: boolean;
}

/**
 * A verb or a namespace written where a value is read.
 *
 * A bare-argument run has no terminator: `(args+=ActionArg)*` ends when it meets
 * a token no `Atom` can begin with, and a name is not one of those. So
 * `print 1 print 2` does not fail, it merges: the second `print` becomes an
 * argument to the first, evaluates to nothing, and the program prints
 * `1 null 2`. That is the one mistake in this language that produces a wrong
 * program which still runs, which is why it is said here and not left to a type.
 *
 * `VN2018` already says this when the swallowed word happens not to be a name
 * the language knows, and the two never overlap: every prelude name and every
 * namespace the registry knows counts as bound there, which is the hole this
 * fills.
 *
 * @param node Any node of the document; only the three rules that take bare
 * arguments, and a binding's value, are answered about.
 * @returns One VN2027 per bare name that cannot be the value it stands for.
 */
export function checkVerbAsAValue(node: AstNode, ctx: CheckContext): Problem[] {
  const merged = bareArguments(node)
    .filter((arg) => notAValue(arg, ctx))
    .map((arg) => ranTogether(arg.ref, ctx));
  const alone = readAlone(node, ctx);
  return alone ? [...merged, alone] : merged;
}

/**
 * The arguments of this node that are one bare name and nothing more.
 *
 * Three rules spell `(args+=ActionArg)*` and all three starve the same way, so
 * all three are asked. A name with anything after it belongs to somebody else:
 * `io.args` parses as a `Member`, and a namespace in member position is exactly
 * what a namespace is for.
 */
function bareArguments(node: AstNode): BareArg[] {
  const args: Expr[] =
    isActionCall(node) || isLetStmt(node) || isMatcherClause(node) ? node.args : [];
  return args.flatMap((arg, at) =>
    isRef(arg) ? [{ ref: arg, swallowed: at < args.length - 1 }] : [],
  );
}

/**
 * A binding whose whole value is one bare name, read or called.
 *
 * Only when nothing follows it. `let stop = fail "the guard fired"` is a verb
 * being called, which is what a `let` with trailing arguments means and what
 * `checkLet` already reads it as; `const a = print` is the verb itself, read.
 */
function readAlone(node: AstNode, ctx: CheckContext): Problem | undefined {
  if (!isLetStmt(node) || node.args.length > 0 || node.opts) return undefined;
  const read = bareNameRead(node.value);
  if (!read || !notAValue({ ref: read, swallowed: false }, ctx)) return undefined;
  return nothingBehindIt(read, ctx);
}

/**
 * The bare name a binding's value reads, whether it reads it or calls it.
 *
 * `const a = print("x")` is the same mistake about the same name as
 * `const a = print`, and it was the worse half: brackets in a value position do
 * not carry a verb out, they read it as a value, which is `null`, and then call
 * that. So `venn check` passed a program which could only ever fail, for every
 * prelude verb, on every input. One name, one sentence, both spellings.
 */
function bareNameRead(value: Expr): Ref | undefined {
  if (isRef(value)) return value;
  return isCall(value) && isRef(value.callee) ? value.callee : undefined;
}

/**
 * Whether this bare name stands for something that is not a value.
 *
 * The two halves are not the same rule, and the difference is what each one
 * answers when it is read. A verb answers null, always, so a verb read as a
 * value is a mistake wherever it appears. A namespace answers the namespace,
 * which the language shows on purpose: `print io` is how a reader finds out
 * that `io.args` exists. So a namespace is only reported when an argument
 * follows it, because that trailing argument is the proof that what came before
 * it was a statement of its own.
 *
 * A binding of the same spelling wins either way, exactly as it does when it
 * runs: `const path = req.url.before("?")` is a string, whatever `venn/path` is
 * called. `declared` catches the `fn`, `fragment` and `namespace` a file writes
 * for itself, minus the imports it also holds, because importing `io` is what
 * puts the namespace here in the first place and cannot excuse reading it.
 */
function notAValue(arg: BareArg, ctx: CheckContext): boolean {
  const name = arg.ref.name;
  if (OF_THE_RUN.has(name) || bindsItself(name, ctx)) return false;
  if (PRELUDE.has(name)) return true;
  return arg.swallowed && (ctx.imported.has(name) || ctx.registry.hasNamespace(name));
}

/**
 * Whether a name of this file's own stands where a namespace would.
 *
 * A binding of the same spelling wins, exactly as it does when it runs, so a
 * parameter called `kit` is not the `kit` namespace however many verbs that
 * namespace publishes. Shared with the purity check, which asks the same
 * question of a call's receiver and must answer it the same way.
 *
 * @param name The head of the path, before any dot.
 * @param ctx The document's resolved names.
 * @returns Whether the file binds it itself rather than importing it.
 */
export function bindsItself(name: string, ctx: CheckContext): boolean {
  if (ctx.bound.has(name)) return true;
  return ctx.declared.has(name) && !ctx.imported.has(name);
}

/**
 * The merge, said as a merge.
 *
 * The span is the swallowed name, because that is where the separator goes: the
 * character that is missing sits immediately before it.
 */
function ranTogether(node: Ref, ctx: CheckContext): Problem {
  const title = `${describe(node.name)}, so this line is read as one statement.`;
  const help = `Put a \`;\` or a newline before \`${node.name}\` to start the next statement.`;
  return { ...problemAt({ node, ctx, spec: CODES.VN2027_NOT_A_VALUE, title }), help };
}

/**
 * The same name with nothing swallowed after it, which only a verb reaches: no
 * separator is missing there, only a value.
 */
function nothingBehindIt(node: Ref, ctx: CheckContext): Problem {
  const title = `${describe(node.name)}, and reading one answers nothing.`;
  const help = `An action is carried out, not read: \`${node.name}\` goes on a line of its own, with its arguments after it.`;
  return { ...problemAt({ node, ctx, spec: CODES.VN2027_NOT_A_VALUE, title }), help };
}

/** Which of the two it is, in the words the rest of the checker uses for each. */
function describe(name: string): string {
  return `\`${name}\` is ${PRELUDE.has(name) ? "an action" : "a namespace"}, not a value`;
}
