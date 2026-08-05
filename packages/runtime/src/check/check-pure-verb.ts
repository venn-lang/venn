import {
  type ActionCall,
  type AstNode,
  buildProblem,
  type Call,
  CODES,
  dottedPath,
  isActionCall,
  isCall,
  isFnDecl,
  isFnExpr,
  isLetStmt,
  type LetStmt,
  type Problem,
  pureBodyCannotCall,
} from "@venn-lang/core";
import type { ResolvedAction } from "../registry/index.js";
import { actionTarget, nodeSpan, PRELUDE, resolveTarget } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { bindsItself } from "./check-verb-as-a-value.js";
import { IN_A_STATEMENT } from "./instead-of-a-lambda.js";

/**
 * The one verb a pure body may run.
 *
 * Raising is not an effect on the world: a body that refuses its input still
 * touches nothing and still answers the same way for the same arguments, and
 * "validate and refuse" is the most common shape a real function has.
 */
const RAISES = "fail";

/**
 * A verb called from inside a `fn`, in any of the three ways one can be written.
 *
 * This is where the purity of a `fn` is decided, all of it. The grammar used to
 * hold half the rule in the shape of `FnBody`, and a shape can only refuse what
 * it can see: `print "x"` alone on its line, never `io.eprint("x")`, which is an
 * ordinary expression and always will be. So the whole rule is here, keyed on
 * what the callee resolves to rather than on how the call was spelled, which is
 * what makes the same sentence right at every layout.
 *
 * @param node Any node of the document, since a verb can be written as a
 * statement, as the value of a binding, or as a call in expression position.
 * @param ctx The document's resolved names, for asking what a callee is.
 * @returns `VN2024` when this reaches the world from a pure body, nothing
 * otherwise.
 */
export function checkPureVerb(node: AstNode, ctx: CheckContext): Problem[] {
  if (!insideAPureBody(node)) return [];
  const called = verbNamedBy(node, ctx);
  if (called === undefined) return [];
  // A lambda is a pure body with nowhere to move a verb to, so it names its own
  // way out; a `fn` somebody declared takes the one the sentence has always had.
  const instead = insideALambda(node) ? IN_A_STATEMENT : undefined;
  return [
    buildProblem({
      spec: CODES.VN2024_VERB_IN_A_PURE_BODY,
      span: nodeSpan(node, ctx.uri),
      title: pureBodyCannotCall(called, instead),
    }),
  ];
}

/** Which of the three spellings this node is, and the verb it names. */
function verbNamedBy(node: AstNode, ctx: CheckContext): string | undefined {
  if (isLetStmt(node)) return boundVerb(node, ctx);
  if (isActionCall(node)) return calledForEffect(node);
  if (isCall(node)) return verbInAValue(node, ctx);
  return undefined;
}

/**
 * `let a = io.print "x"`: the trailing argument is what makes a `let` a call.
 *
 * The rule that reads it lives in `LetStmt`, which a pure body may hold, so the
 * same line with two words in front of it parsed, checked clean, and then did
 * nothing at all, because a compiled body reads only the value and never the
 * arguments beside it.
 *
 * The callee is asked about here, unlike in statement position, because a name
 * of the file's own can legitimately stand there. `fn after(x) { let a = x  a }`
 * is a missing separator, not a verb: it parses as `let a = (x a)`, and calling
 * a parameter a verb would one day tell a reader their callback is one.
 */
function boundVerb(stmt: LetStmt, ctx: CheckContext): string | undefined {
  if (stmt.args.length === 0 && stmt.opts === undefined) return undefined;
  const target = actionTarget(stmt.value);
  if (target === undefined) return "a verb";
  const { namespace } = resolveTarget(target, ctx.aliases);
  return bindsItself(namespace, ctx) ? undefined : target;
}

/**
 * A call written as a statement of the body, whose value nothing keeps.
 *
 * Every one of those but `fail` is refused, and the callee is deliberately not
 * asked about: in a pure body a call's only effect is its value, so a call that
 * keeps none is either a verb or a line that does nothing whatever it names. The
 * compiler refuses the same shape in the same words, so neither can drift.
 */
function calledForEffect(call: ActionCall): string | undefined {
  return call.target === RAISES ? undefined : call.target;
}

/**
 * `io.eprint(m)` where a value is wanted: an ordinary call expression, and the
 * hole the grammar could never close.
 *
 * Here the value IS kept, so a call is legitimate until the callee says
 * otherwise. Three things are asked, in order. A binding of the file's own wins
 * first: a parameter called `kit` is not the `kit` namespace, however many verbs
 * that namespace publishes. A prelude verb is the world by definition. And
 * anything else is asked of the registry, because only the run knows what a name
 * resolves to, which is the whole reason this cannot live in the grammar.
 */
function verbInAValue(call: Call, ctx: CheckContext): string | undefined {
  const path = dottedPath(call.callee);
  if (path === undefined || path === RAISES) return undefined;
  const { namespace, name } = resolveTarget(path, ctx.aliases);
  if (bindsItself(namespace, ctx)) return undefined;
  if (PRELUDE.has(path)) return path;
  return reachesTheWorld(ctx.registry.action({ namespace, name })) ? path : undefined;
}

/**
 * Whether the verb behind an action reaches outside the process.
 *
 * Read off the capability its plugin declares, because that is where the
 * language already says so and saying it twice would be two rules. `venn/json`
 * requires none and its own docblock calls itself pure; `venn/io` requires `io`,
 * and `venn/http` requires `net`. So `json.parse(text)` in a `fn` is text
 * becoming a value and stays legal, and what a pure body may not call is a plugin
 * that had to ask the host for something.
 *
 * An action may then say that it does not use what its plugin asked for, and that
 * wins. A capability is declared per plugin while purity is a property of each
 * verb: `date.now` reads the clock and `date.format` writes out a moment it was
 * handed, from the same namespace. Without the override the coarse answer refuses
 * `date.format`, and a namespace with no pure path leaves an author rewriting
 * correct code into `fragment`s to satisfy a rule about effects it does not have.
 *
 * The default is the safe one and is unchanged: an unannotated verb inherits its
 * plugin, so a plugin author who says nothing never accidentally gets permission
 * to do I/O inside something the language calls pure. The claim is not taken on
 * trust either. `a-plugin-declares-what-it-reaches.test.ts` in `@venn-lang/stdlib`
 * drives every verb and refuses any that claims `pure` while asking for a port,
 * which is the check `requires` itself went without until today.
 */
function reachesTheWorld(resolved: ResolvedAction | undefined): boolean {
  if (resolved?.action?.pure) return false;
  // A prelude verb has no plugin at all, so the chain has to reach past
  // `plugin` as well: `print` is refused by its own rule, not by this one.
  return (resolved?.plugin?.requires ?? []).length > 0;
}

/** Whether this node sits inside a `fn`'s body, which is pure at every depth. */
function insideAPureBody(node: AstNode): boolean {
  for (let at: AstNode | undefined = node.$container; at; at = at.$container) {
    if (isFnDecl(at) || isFnExpr(at)) return true;
  }
  return false;
}

/**
 * Whether the pure body around this node is a lambda rather than a declared `fn`.
 *
 * The nearest one wins, which is what makes `fn f(ns) => ns.map(n => …)` a
 * lambda: the way out a reader can take is decided by the body they are
 * standing in, not by the outermost one they happen to be nested inside.
 */
function insideALambda(node: AstNode): boolean {
  for (let at: AstNode | undefined = node.$container; at; at = at.$container) {
    if (isFnDecl(at) || isFnExpr(at)) return isFnExpr(at);
  }
  return false;
}
