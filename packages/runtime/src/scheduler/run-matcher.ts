import { VennError } from "@venn-lang/contracts";
import {
  buildDiff,
  CODES,
  type Diff,
  type ExpectStmt,
  evaluate,
  type MatcherClause,
} from "@venn-lang/core";
import type { MatcherArgs, MatcherDefinition } from "@venn-lang/sdk";
import { createMatcherContext } from "../context/index.js";
import type { ResolvedMatcher } from "../registry/index.js";
import type { Scope } from "../scope/index.js";
import { callParams } from "./call-params.js";
import type { Engine } from "./engine.types.js";
import { nodeSource } from "./node-span.js";

/** The pass/fail, the one-line message, and the diff that message summarises. */
export interface MatcherOutcome {
  passed: boolean;
  message?: string;
  diff?: Diff;
}

/** Resolve a bareword matcher from the registry and run it against the subject. */
export async function evalMatcher(args: {
  engine: Engine;
  stmt: ExpectStmt;
  scope: Scope;
}): Promise<MatcherOutcome> {
  const clause = args.stmt.matcher as MatcherClause;
  const resolved = args.engine.registry.matcher(clause.name);
  if (!resolved) throw unknownMatcher(clause.name);
  const input = buildArgs({ ...args, resolved, clause });
  const raw = await resolved.matcher.test(input);
  if (args.stmt.negate ? !raw : raw) return { passed: true };
  return failure({ matcher: resolved.matcher, input, stmt: args.stmt, engine: args.engine });
}

/**
 * A failing matcher hands back the two sides it compared, labelled with how the
 * flow spelled the subject. A negated expect gets no diff on purpose: under
 * `not` the two sides matched, and "expected 200, actual 200" explains nothing.
 *
 * This is where a matcher is handed `show`, so the values in a failure title
 * read the way `print` writes them rather than the way a plugin would guess.
 */
function failure(args: {
  matcher: MatcherDefinition;
  input: MatcherArgs<unknown>;
  stmt: ExpectStmt;
  engine: Engine;
}): MatcherOutcome {
  const ctx = createMatcherContext(args.engine.ctx);
  const message = args.matcher.message(args.input, ctx);
  const detail = args.stmt.negate ? undefined : args.matcher.detail?.(args.input, ctx);
  if (!detail) return { passed: false, message };
  const label = subjectLabel(args.stmt);
  return { passed: false, message, diff: buildDiff({ label, ...detail }) };
}

/** The diff's header: the subject as the flow spelled it, on one line. */
function subjectLabel(stmt: ExpectStmt): string {
  const source = stmt.subject ? nodeSource(stmt.subject).replace(/\s+/g, " ").trim() : "";
  return source === "" ? "value" : source;
}

function buildArgs(args: {
  resolved: ResolvedMatcher;
  stmt: ExpectStmt;
  clause: MatcherClause;
  scope: Scope;
  engine: Engine;
}): MatcherArgs<unknown> {
  const { stmt, clause, scope } = args;
  const subject = stmt.subject ? evaluate(stmt.subject, scope) : undefined;
  const positional = clause.args.map((expr) => evaluate(expr, scope));
  return { subject, args: positional, params: matcherOptions(args) };
}

/**
 * A matcher's options map goes through the same gate an action's does: a key it
 * never declared is refused rather than dropped, and a value it rejects reads as
 * one line. Nothing checks these before the run, since `checkOptions` only ever
 * sees calls, so this is the only place `{ withinn: 1 }` is ever noticed.
 */
function matcherOptions(args: {
  resolved: ResolvedMatcher;
  stmt: ExpectStmt;
  clause: MatcherClause;
  scope: Scope;
  engine: Engine;
}): unknown {
  const { resolved, stmt, clause, scope, engine } = args;
  const raw = clause.opts ? evaluate(clause.opts, scope) : {};
  const schema = resolved.matcher.params;
  return callParams({ schema, opts: clause.opts, raw, site: stmt, uri: engine.uri });
}

function unknownMatcher(name: string): VennError {
  return new VennError({
    code: CODES.VN2004_UNKNOWN_MATCHER.code,
    message: `Unknown matcher "${name}".`,
    detail: { name },
  });
}
