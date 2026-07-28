import type { CompletionContext, CursorText } from "./completion.types.js";

const PACKAGE = /\buse\s+"([^"]*)$/;
const MODULE_PATH = /\bfrom\s+"([^"]*)$/;
const IMPORT_NAME = /\bimport\s*\{([^}]*)$/;
/**
 * The whole dotted receiver, so `cfg.server.` offers what `cfg.server` holds.
 *
 * The lookbehind makes the match start at a token boundary. Without it the
 * receiver could be found inside something else: `_` opens an identifier, so
 * `1_000_000.` would take `_000_000` for its receiver and offer nothing.
 */
const ACTION = /(?<![\w.])([A-Za-z_]\w*(?:\.\w+)*)\.(\w*)$/;
const ANNOTATION = /@(\w*)$/;
const FRAGMENT = /\brun\s+(\w*)$/;
const MATCHER = /\bexpect\b\s+\S+\s+(\w*)$/;
/**
 * Where a type goes: after the `:` of a field, a parameter or a binding, after
 * the `->` of a declared return, or after the `|` of a union.
 *
 * A name has to sit before the colon, which is what tells a type annotation
 * from a map entry: `{ port: ▮ }` holds a value, `port: ▮` in a `type` block
 * holds a type. The brace is the difference, and the caller has already
 * classified an open one.
 */
const TYPE_POSITION = /(?:^|[^:])(?::|->|\|)\s*([A-Za-z_][\w.]*)?$/;
/**
 * A verb, a space, and whatever is being written after it: `http.on ▮`,
 * `http.on api ▮`, `print ▮`. The leading anchor keeps this to the head of a
 * statement, so `1 + ▮` and the tail of an expression are not swept in.
 */
const ARGUMENT = /^\s*([A-Za-z_]\w*(?:\.\w+)*)\s+[^{}]*$/;
const FROM_PATH = /\bfrom\s+"([^"]+)"/;
/**
 * A dot whose receiver no path can name: `1234.567.round`, `f(x).len`,
 * `xs[0].name`, `"ab".upper`. Tried after {@link ACTION}, so a receiver that is
 * a name goes there first and this catches the rest: a digit, a closing
 * bracket, a quote. There is nothing to look up by text, so the node under the
 * cursor answers instead.
 */
const MEMBER = /[\w)\]"']\.(\w*)$/;

/** The dotted path that owns the `{` we are inside of, with no brace between. */
const OPTION_OWNER = /([A-Za-z_]\w*(?:\.\w+)+)[^{}]*$/;

/**
 * Classify the cursor from the text before it. String contexts are tested first:
 * a module path like `#shared/auth.vn` also looks like `namespace.action`.
 *
 * @param text The line, the prefix up to the cursor and the document before it.
 * @returns The narrowest context that matches, or `statement` when none does.
 */
export function contextAt(text: CursorText): CompletionContext {
  const { prefix, line } = text;
  const inString = stringContext(prefix, line);
  if (inString) return inString;
  const action = ACTION.exec(prefix);
  if (action?.[1]) return { kind: "action", receiver: action[1], from: back(prefix, action[2]) };
  const member = MEMBER.exec(prefix);
  if (member) return { kind: "member", from: back(prefix, member[1]) };
  const annotation = ANNOTATION.exec(prefix);
  if (annotation) return { kind: "annotation", from: back(prefix, annotation[1]) };
  const fragment = FRAGMENT.exec(prefix);
  if (fragment) return { kind: "fragment", from: back(prefix, fragment[1]) };
  const matcher = MATCHER.exec(prefix);
  if (matcher) return { kind: "matcher", from: back(prefix, matcher[1]) };
  return (
    optionContext(text) ??
    typeContext(text) ??
    argumentContext(prefix) ?? { kind: "statement", from: back(prefix, trailingWord(prefix)) }
  );
}

/**
 * `id: ▮`: a type is due.
 *
 * Only outside an options map, which the caller has already ruled out: inside
 * `{ … }` a colon introduces a value, and the two look identical to a regex.
 */
function typeContext(text: CursorText): CompletionContext | undefined {
  const found = TYPE_POSITION.exec(text.prefix);
  if (!found) return undefined;
  return { kind: "typeName", from: back(text.prefix, found[1]) };
}

/** `http.on ▮`: the head of the line is a verb, and an argument is due. */
function argumentContext(prefix: string): CompletionContext | undefined {
  const found = ARGUMENT.exec(prefix);
  if (!found?.[1]) return undefined;
  return { kind: "argument", target: found[1], from: back(prefix, trailingWord(prefix)) };
}

/**
 * `http.post url { … }`: offer the keys that call accepts. Only the map that
 * belongs to the call qualifies: a nested `{ … }` has a shape of its own that
 * the schema does not describe, so nothing is offered there rather than
 * something wrong.
 */
function optionContext(text: CursorText): CompletionContext | undefined {
  const open = innermostOpenBrace(text.before);
  if (open < 0) return undefined;
  const target = OPTION_OWNER.exec(text.before.slice(0, open))?.[1];
  if (!target) return undefined;
  return { kind: "optionKey", target, from: back(text.prefix, trailingWord(text.prefix)) };
}

/** The `{` still open at the cursor, scanning backwards. */
function innermostOpenBrace(before: string): number {
  let depth = 0;
  for (let index = before.length - 1; index >= 0; index -= 1) {
    if (before[index] === "}") depth += 1;
    else if (before[index] === "{") {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function stringContext(prefix: string, line: string): CompletionContext | undefined {
  const pkg = PACKAGE.exec(prefix);
  if (pkg) return { kind: "package", from: back(prefix, pkg[1]) };
  const path = MODULE_PATH.exec(prefix);
  if (path) return { kind: "modulePath", from: back(prefix, path[1]), partial: path[1] ?? "" };
  const named = IMPORT_NAME.exec(prefix);
  if (named)
    return { kind: "importName", from: back(prefix, lastName(named[1])), path: pathOf(line) };
  return undefined;
}

// The name being typed inside `{ a, b| }`: everything after the last comma.
function lastName(inside: string | undefined): string {
  const tail = (inside ?? "").split(",").pop() ?? "";
  return tail.trimStart();
}

function pathOf(line: string): string | undefined {
  return FROM_PATH.exec(line)?.[1];
}

function back(prefix: string, partial: string | undefined): number {
  return prefix.length - (partial?.length ?? 0);
}

/**
 * The word being typed at the end of `text`, empty when the last character is
 * not part of one.
 *
 * Scanned backwards rather than matched with `/(\w*)$/`. That pattern has
 * nothing to anchor to, so the engine tries it at every position, which is
 * quadratic in the length of the line: 27ms at ten thousand characters and
 * 454ms at forty thousand, while a completion is meant to be instant. A line is
 * as long as whoever wrote the file made it.
 */
function trailingWord(text: string): string {
  let at = text.length;
  while (at > 0 && isWordCharacter(text.charCodeAt(at - 1))) at -= 1;
  return text.slice(at);
}

/** `\w`: a digit, a letter or an underscore. */
function isWordCharacter(code: number): boolean {
  if (code >= 48 && code <= 57) return true;
  if (code >= 65 && code <= 90) return true;
  if (code >= 97 && code <= 122) return true;
  return code === 95;
}
