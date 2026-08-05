import {
  type AstNode,
  buildProblem,
  CODES,
  isMember,
  nearestName,
  type Problem,
  type Span,
} from "@venn-lang/core";
import { actionTarget, nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { notImportedHere } from "./not-imported-here.js";

/** `env.NAME` as it appears inside a `${…}` placeholder. */
const ENV_READ = /\benv\.([A-Za-z_]\w*)/g;

/** Always present: the runner sets it to the `--env` that was selected. */
const BUILT_IN = new Set(["name"]);

/**
 * Match every `env.*` read against what `venn.toml` declares, so a typo is an
 * error rather than an empty string and a puzzling 404.
 *
 * The missing `import { env }` is not asked here. It used to be, and it was
 * asked first, so a file that had not written the line was told to write it and
 * never told that the variable it was reading does not exist. That sentence
 * belongs to the walk in `check-namespace-use.ts`, which says it once.
 *
 * Nothing is reported when the manifest could not be read: a wrong error about a
 * variable that does exist is worse than no error at all.
 */
export function checkEnv(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isMember(node) || isMember(node.$container)) return [];
  const path = actionTarget(node);
  const name = path?.startsWith("env.") ? path.slice(4) : undefined;
  if (name === undefined || name.includes(".")) return [];
  if (!ctx.env || declared(name, ctx.env)) return [];
  return [envProblem(name, nodeSpan(node, ctx.uri), ctx)];
}

/**
 * The same checks for text the parser never turned into nodes: `"${env.X}"`.
 *
 * A slot is parsed apart from the document, so the walk that says a namespace
 * was never imported cannot reach one and this is the only eye on it.
 */
export function envProblemsIn(source: string, span: Span, ctx: CheckContext): Problem[] {
  const names = [...source.matchAll(ENV_READ)].map((match) => match[1] ?? "").filter(Boolean);
  if (names.length === 0) return [];
  const said = importAdvice(span, ctx);
  if (!ctx.env) return said;
  const undeclared = names.filter((name) => !declared(name, ctx.env ?? new Set()));
  return [...said, ...undeclared.map((name) => envProblem(name, span, ctx))];
}

/** Said here because the walk over the document's own tree never enters a slot. */
function importAdvice(span: Span, ctx: CheckContext): Problem[] {
  const pkg = ctx.imported.has("env") ? undefined : ctx.registry.packageOf("env");
  return pkg ? [notImportedHere({ name: "env", pkg, span })] : [];
}

function declared(name: string, env: ReadonlySet<string>): boolean {
  return env.has(name) || BUILT_IN.has(name);
}

/** The undeclared-variable problem, with the nearest declared name as a hint. */
export function envProblem(name: string, span: Span, ctx: CheckContext): Problem {
  const hint = nearestName(name, ctx.env ?? []);
  const title = hint
    ? `"env.${name}" is not declared in venn.toml. Did you mean "env.${hint}"?`
    : `"env.${name}" is not declared in venn.toml.`;
  return buildProblem({ spec: CODES.VN2006_UNKNOWN_ENV, span, title });
}
