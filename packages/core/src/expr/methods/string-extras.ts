import { type Method, nativeFn } from "../native.types.js";

const COMBINING = /[\u0300-\u036f]/g;

/** Text handling a script actually needs: words, lines, casing, slugs, matching. */
export const STRING_EXTRAS: Record<string, Method> = {
  words: (text: string) => text.split(/\s+/).filter(Boolean),
  lines: (text: string) => text.split(/\r?\n/),
  chars: (text: string) => [...text],
  capitalize: (text: string) => text.charAt(0).toUpperCase() + text.slice(1),
  title: (text: string) => text.replace(/\S+/g, capitalizeWord),
  slugify: (text: string) => slugify(text),
  isEmpty: (text: string) => text.length === 0,
  isBlank: (text: string) => text.trim().length === 0,
  trimStart: (text: string) => text.trimStart(),
  trimEnd: (text: string) => text.trimEnd(),
  count: (text: string) => nativeFn((args) => occurrences(text, String(args[0] ?? ""))),
  matches: (text: string) => nativeFn((args) => matches(text, String(args[0] ?? ""))),
  test: (text: string) => nativeFn((args) => regex(String(args[0] ?? ""))?.test(text) ?? false),
  before: (text: string) => nativeFn((args) => cut(text, String(args[0] ?? ""), true)),
  after: (text: string) => nativeFn((args) => cut(text, String(args[0] ?? ""), false)),
  ensureStart: (text: string) => nativeFn((args) => prefixed(text, String(args[0] ?? ""))),
  ensureEnd: (text: string) => nativeFn((args) => suffixed(text, String(args[0] ?? ""))),
};

function capitalizeWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** `"João Gonçalves"` becomes `"joao-goncalves"`: ASCII-safe, url-ready. */
function slugify(text: string): string {
  const plain = text.normalize("NFD").replace(COMBINING, "").toLowerCase();
  return plain.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function occurrences(text: string, needle: string): number {
  return needle === "" ? 0 : text.split(needle).length - 1;
}

/** Every match of a pattern, as a list of strings. An invalid pattern matches nothing. */
function matches(text: string, pattern: string): string[] {
  const expression = regex(pattern, "g");
  return expression ? [...text.matchAll(expression)].map((match) => match[0]) : [];
}

function regex(pattern: string, flags = ""): RegExp | undefined {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return undefined;
  }
}

function cut(text: string, marker: string, keepHead: boolean): string {
  const at = text.indexOf(marker);
  if (at < 0) return keepHead ? text : "";
  return keepHead ? text.slice(0, at) : text.slice(at + marker.length);
}

function prefixed(text: string, prefix: string): string {
  return text.startsWith(prefix) ? text : `${prefix}${text}`;
}

function suffixed(text: string, suffix: string): string {
  return text.endsWith(suffix) ? text : `${text}${suffix}`;
}
