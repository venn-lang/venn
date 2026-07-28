import {
  type AstNode,
  buildProblem,
  CODES,
  display,
  type MapEntry,
  type MapLit,
  type Problem,
  ProblemError,
  typeName,
} from "@venn-lang/core";
import type { ZodType } from "@venn-lang/sdk";
import { nodeSpan } from "./node-span.js";
import { unknownOptions } from "./unknown-option.js";

/** The bits of a Zod failure this reads. Structural, so no Zod internals leak out. */
interface Issue {
  code?: string;
  path?: readonly PropertyKey[];
  expected?: string;
  values?: readonly unknown[];
}

/** Zod's word for a type, in the word the language uses for it. */
const WORDS: Record<string, string> = {
  object: "map",
  record: "map",
  array: "list",
  boolean: "bool",
  int: "number",
  bigint: "number",
};

/**
 * The options map of a call, an action's or a matcher's, validated before the
 * thing it belongs to ever sees it.
 *
 * Unknown keys are refused rather than stripped, because `z.object` drops them
 * in silence and `crypto.hash "x" { algorithmm: "sha512" }` would then hash with
 * the default. A rejected value becomes a `Problem` rather than escaping as a
 * ZodError, whose `message` is a JSON dump of issues.
 *
 * @param args.site Where the call is written, for a failure with no smaller node
 * to point at: a required option nobody typed leaves nothing to underline.
 * @returns The parsed options.
 * @throws ProblemError `VN3010` when a key is unknown or a value is rejected.
 */
export function callParams(args: {
  schema: ZodType | undefined;
  opts: MapLit | undefined;
  raw: unknown;
  site: AstNode;
  uri: string;
}): unknown {
  const { schema, opts, raw, site, uri } = args;
  if (!schema) return raw;
  const unknown = unknownOptions({ opts, params: schema, uri });
  if (unknown[0]) throw new ProblemError(unknown[0]);
  return parsed({ schema, opts, raw, site, uri });
}

/** Parse, and turn a rejection into a sentence about the option that failed. */
function parsed(args: {
  schema: ZodType;
  opts: MapLit | undefined;
  raw: unknown;
  site: AstNode;
  uri: string;
}): unknown {
  try {
    return args.schema.parse(args.raw);
  } catch (error) {
    const issue = firstIssue(error);
    // Not a schema rejection: a transform threw, and it already says why.
    if (!issue) throw error;
    const { raw, opts, site, uri } = args;
    throw new ProblemError(badOption({ issue, raw, opts, site, uri }));
  }
}

function badOption(args: {
  issue: Issue;
  raw: unknown;
  opts: MapLit | undefined;
  site: AstNode;
  uri: string;
}): Problem {
  const path = args.issue.path ?? [];
  return buildProblem({
    spec: CODES.VN3010_TYPE_MISMATCH,
    // The entry that failed, else the map; a required option nobody wrote has
    // neither, and then the call itself is the nearest true place.
    span: nodeSpan(entryFor(args.opts, path) ?? args.opts ?? args.site, args.uri),
    title: title({ key: path.join("."), issue: args.issue, value: valueAt(args.raw, path) }),
  });
}

/**
 * One line, naming the option and what it wanted. Only the shapes worth
 * modelling get their own sentence; anything else says so plainly rather than
 * dressing up an issue it does not understand.
 */
function title(args: { key: string; issue: Issue; value: unknown }): string {
  const { key, issue, value } = args;
  if (!key) return "These options are not valid here.";
  if (issue.code === "invalid_value" && issue.values) return oneOf(key, issue.values, value);
  if (issue.code !== "invalid_type" || !issue.expected) return `"${key}" is not a valid option.`;
  const needs = WORDS[issue.expected] ?? issue.expected;
  if (value === undefined) return `"${key}" is required here, and it takes a ${needs}.`;
  return `"${key}" needs a ${needs}, and ${shown(value)} is a ${typeName(value)}.`;
}

/** `{ algorithm: "sha5" }` against a schema that lists the digests it knows. */
function oneOf(key: string, values: readonly unknown[], value: unknown): string {
  const accepted = values.map((option) => shown(option)).join(", ");
  return `"${key}" must be one of ${accepted} — not ${shown(value)}.`;
}

/** A value as a message shows it: strings quoted, so `"soon"` reads as text. */
function shown(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : display(value);
}

function valueAt(raw: unknown, path: readonly PropertyKey[]): unknown {
  let value = raw;
  for (const key of path) value = (value as Record<PropertyKey, unknown> | undefined)?.[key];
  return value;
}

/** The written entry to underline, when the failure names a key this map spells. */
function entryFor(opts: MapLit | undefined, path: readonly PropertyKey[]): MapEntry | undefined {
  const key = String(path[0] ?? "");
  return opts?.entries.find((entry) => entry.key === key);
}

/** Zod's failure, read structurally: the runtime does not depend on zod itself. */
function firstIssue(error: unknown): Issue | undefined {
  const issues = (error as { issues?: unknown } | undefined)?.issues;
  return Array.isArray(issues) ? (issues[0] as Issue) : undefined;
}
