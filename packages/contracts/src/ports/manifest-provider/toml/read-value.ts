/** A position in the text being read. Mutable, because reading advances it. */
export interface Cursor {
  readonly text: string;
  index: number;
}

/** A cursor over `text`, positioned at the start. */
export function cursor(text: string): Cursor {
  return { text, index: 0 };
}

/**
 * One TOML value: a string, a number, a bool, an array, or an inline table.
 *
 * Reads by walking rather than by splitting, because a comma can sit inside a
 * value: splitting turns `["a,b"]` into two items and leaves
 * `{ version = "^4" }` as the text it was written in.
 */
export function readValue(cur: Cursor): unknown {
  skipSpace(cur);
  const ch = cur.text[cur.index];
  if (ch === '"' || ch === "'") return readString(cur);
  if (ch === "[") return readArray(cur);
  if (ch === "{") return readInlineTable(cur);
  return readBare(cur);
}

export function skipSpace(cur: Cursor): void {
  while (/\s/.test(cur.text[cur.index] ?? "")) cur.index++;
}

/** A basic string reads escapes; a literal one, in single quotes, does not. */
function readString(cur: Cursor): string {
  const quote = cur.text[cur.index];
  cur.index++;
  let out = "";
  while (cur.index < cur.text.length && cur.text[cur.index] !== quote) {
    if (quote === '"' && cur.text[cur.index] === "\\") out += unescaped(cur);
    else out += cur.text[cur.index++];
  }
  cur.index++;
  return out;
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"' };

function unescaped(cur: Cursor): string {
  const code = cur.text[cur.index + 1] ?? "";
  cur.index += 2;
  return ESCAPES[code] ?? code;
}

function readArray(cur: Cursor): unknown[] {
  cur.index++;
  const out: unknown[] = [];
  while (!atClose(cur, "]")) {
    out.push(readValue(cur));
    skipSeparator(cur);
  }
  cur.index++;
  return out;
}

function readInlineTable(cur: Cursor): Record<string, unknown> {
  cur.index++;
  const out: Record<string, unknown> = {};
  while (!atClose(cur, "}")) {
    const key = readKey(cur);
    if (key === undefined) break;
    out[key] = readValue(cur);
    skipSeparator(cur);
  }
  cur.index++;
  return out;
}

function readKey(cur: Cursor): string | undefined {
  skipSpace(cur);
  const equals = cur.text.indexOf("=", cur.index);
  if (equals < 0) return undefined;
  const raw = cur.text.slice(cur.index, equals).trim();
  cur.index = equals + 1;
  return raw.replace(/^["']|["']$/g, "");
}

function atClose(cur: Cursor, close: string): boolean {
  skipSpace(cur);
  return cur.index >= cur.text.length || cur.text[cur.index] === close;
}

function skipSeparator(cur: Cursor): void {
  skipSpace(cur);
  if (cur.text[cur.index] === ",") cur.index++;
}

/** Anything unquoted: `true`, `12`, `1.5`, or a word the manifest gives meaning. */
function readBare(cur: Cursor): unknown {
  const start = cur.index;
  while (cur.index < cur.text.length && !",]}".includes(cur.text[cur.index] ?? "")) cur.index++;
  const raw = cur.text.slice(start, cur.index).trim();
  if (raw === "true" || raw === "false") return raw === "true";
  const num = Number(raw);
  return raw !== "" && !Number.isNaN(num) ? num : raw;
}
