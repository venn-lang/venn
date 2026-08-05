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

/**
 * The bits of a Zod failure this reads. Structural, so no Zod internals leak out.
 *
 * An `invalid_union` also carries `errors: Issue[][]`, one group per arm, and
 * that is deliberately not modelled: the arms of `Duration` are a string, a
 * number and a duration literal, and reporting the first two as what the option
 * takes would leave out the third and read as a lie. What the option does not
 * take is the honest thing to say, and needs nothing from the arms.
 */
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

/**
 * What to say about a value one option's own schema refuses, or nothing when it
 * accepts it.
 *
 * The checker asks this of what is written and {@link callParams} says the same
 * thing of what a run evaluated, so the sentence in the editor is the sentence
 * in the terminal. A schema whose transform throws rather than reporting an
 * issue is still a refusal and reads as one.
 *
 * @param args.key The option's name, which is what the sentence is about.
 * @param args.schema The schema declared for that key.
 * @param args.value What was written there. Never `undefined`: a value the
 * checker cannot know is one only the run can hold to anything.
 * @returns The sentence, or `undefined` when the value is accepted.
 */
export function optionRefusal(args: {
  key: string;
  schema: ZodType;
  value: unknown;
}): string | undefined {
  const { key, schema, value } = args;
  try {
    schema.parse(value);
    return undefined;
  } catch (error) {
    const issue = firstIssue(error);
    return issue ? title({ key, issue, value }) : refused(key, value);
  }
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
 * One line, naming the option and what it wanted.
 *
 * By the time anything gets here the key is declared: `callParams` refuses an
 * undeclared one first, with its own sentence and a suggestion. So a failure
 * left over is always about the value, and saying `"over" is not a valid
 * option` about a key the schema itself lists was never true. A union arm is
 * the common case and reports `invalid_union`, which carries neither an
 * `expected` nor a set of accepted values: the arms keep their own failures.
 */
function title(args: { key: string; issue: Issue; value: unknown }): string {
  const { key, issue, value } = args;
  if (!key) return "These options are not valid here.";
  if (issue.code === "invalid_value" && issue.values) return oneOf(key, issue.values, value);
  return wantedType(args) ?? refused(key, value);
}

/** The one shape of failure that can name what it wanted: `invalid_type`. */
function wantedType(args: { key: string; issue: Issue; value: unknown }): string | undefined {
  const { key, issue, value } = args;
  if (issue.code !== "invalid_type" || !issue.expected) return undefined;
  const needs = WORDS[issue.expected] ?? issue.expected;
  if (value === undefined) return `"${key}" is required here, and it takes a ${needs}.`;
  return `"${key}" needs a ${needs}, and ${shown(value)} is a ${typeName(value)}.`;
}

/** Everything else: the option exists, and this is not a value it takes. */
function refused(key: string, value: unknown): string {
  if (value === undefined) return `"${key}" is required here.`;
  return `"${key}" does not take ${shown(value)}, which is a ${typeName(value)}.`;
}

/** `{ algorithm: "sha5" }` against a schema that lists the digests it knows. */
function oneOf(key: string, values: readonly unknown[], value: unknown): string {
  const accepted = values.map((option) => shown(option)).join(", ");
  return `"${key}" must be one of ${accepted}, not ${shown(value)}.`;
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
