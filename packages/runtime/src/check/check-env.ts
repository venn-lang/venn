import {
  type AstNode,
  buildProblem,
  CODES,
  isMember,
  type Problem,
  type Span,
} from "@venn-lang/core";
import { actionTarget, nodeSpan } from "../scheduler/index.js";
import { nearestName } from "../suggest/index.js";
import type { CheckContext } from "./check.types.js";

/** `env.NAME` as it appears inside a `${…}` placeholder. */
const ENV_READ = /\benv\.([A-Za-z_]\w*)/g;

/** Always present: the runner sets it to the `--env` that was selected. */
const BUILT_IN = new Set(["name"]);

/**
 * Match every `env.*` read against what `venn.toml` declares, so a typo is an
 * error rather than an empty string and a puzzling 404.
 *
 * Nothing is reported when the manifest could not be read: a wrong error about a
 * variable that does exist is worse than no error at all.
 */
export function checkEnv(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isMember(node) || isMember(node.$container)) return [];
  const path = actionTarget(node);
  const name = path?.startsWith("env.") ? path.slice(4) : undefined;
  if (name === undefined || name.includes(".")) return [];
  const span = nodeSpan(node, ctx.uri);
  if (!ctx.imported.has("env")) return [notImported(span)];
  if (!ctx.env || declared(name, ctx.env)) return [];
  return [envProblem(name, span, ctx)];
}

/**
 * Configuration is brought in like anything else. Reading `env.*` without saying
 * where it comes from is the same hole `use` closes for actions and matchers:
 * the reader should not have to know which names are magic.
 */
function notImported(span: Span): Problem {
  return buildProblem({
    spec: CODES.VN2007_NAMESPACE_NOT_IMPORTED,
    span,
    title: '"env" is not imported in this file.',
    help: 'Write `import { env } from "venn/env"`.',
  });
}

/** The same checks for text the parser never turned into nodes: `"${env.X}"`. */
export function envProblemsIn(source: string, span: Span, ctx: CheckContext): Problem[] {
  const names = [...source.matchAll(ENV_READ)].map((match) => match[1] ?? "").filter(Boolean);
  if (names.length === 0) return [];
  if (!ctx.imported.has("env")) return [notImported(span)];
  const env = ctx.env;
  if (!env) return [];
  return names.filter((name) => !declared(name, env)).map((name) => envProblem(name, span, ctx));
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
