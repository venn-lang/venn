import { parseExpression } from "../parse/index.js";
import { scanInterpolations } from "./scan-interpolations.js";
import type { Template, TemplateHole } from "./template.types.js";

/**
 * Templates already compiled, by the literal's text.
 *
 * Splitting a literal means a full parse per `${…}`, and the result is a pure
 * function of the text, so it is done once. A `.vn` file holds a fixed set of
 * string literals, so this holds one entry per literal.
 */
const compiled = new Map<string, Template>();

/**
 * Split a string literal into the constant text around its placeholders and the
 * parsed expression filling each one.
 *
 * @param text The literal's value, placeholders included.
 * @returns The template, memoised: the same text always yields the same object.
 */
export function compileTemplate(text: string): Template {
  const known = compiled.get(text);
  if (known) return known;
  const template = split(text);
  compiled.set(text, template);
  return template;
}

function split(text: string): Template {
  const chunks: string[] = [];
  const holes: TemplateHole[] = [];
  let cursor = 0;
  for (const slot of scanInterpolations(text)) {
    chunks.push(text.slice(cursor, slot.start));
    holes.push({ source: slot.source, expr: parseExpression(slot.source) });
    cursor = slot.end;
  }
  chunks.push(text.slice(cursor));
  return { chunks, holes };
}
