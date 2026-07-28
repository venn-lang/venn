import type { DocBlock } from "./doc.types.js";

const TAG = /^@(param|returns?|example|deprecated)\b[ \t]*(.*)$/;

interface Section {
  tag: string;
  lines: string[];
}

/** Split doc lines into a summary plus `@param` / `@returns` / `@example` / `@deprecated`. */
export function parseDoc(lines: readonly string[]): DocBlock {
  const doc: DocBlock = { summary: "", params: [], examples: [] };
  const summary: string[] = [];
  let section: Section | undefined;
  for (const line of lines) {
    const match = TAG.exec(line.trim());
    if (!match) (section ? section.lines : summary).push(line);
    else {
      apply(doc, section);
      section = { tag: match[1] as string, lines: [match[2] ?? ""] };
    }
  }
  apply(doc, section);
  doc.summary = summary.join("\n").trim();
  return doc;
}

function apply(doc: DocBlock, section: Section | undefined): void {
  if (!section) return;
  const text = section.lines.join("\n").trim();
  if (section.tag === "param") doc.params.push(splitParam(text));
  else if (section.tag === "example") doc.examples.push(text);
  else if (section.tag === "deprecated") doc.deprecated = text || "This is deprecated.";
  else doc.returns = text;
}

// `@param user  The account to log in with.`: the first word is the name.
function splitParam(text: string): { name: string; text: string } {
  const space = text.search(/\s/);
  if (space < 0) return { name: text, text: "" };
  return { name: text.slice(0, space), text: text.slice(space).trim() };
}
