import { code, fence, labelled, rule, sections } from "../markdown/index.js";
import type { DocBlock, DocParam } from "./doc.types.js";

/**
 * Render a doc block. The prose keeps its own paragraph rhythm; the tagged
 * sections sit below a rule so they read as a distinct band, not as more prose.
 *
 * @returns Markdown, or `undefined` when the block has nothing worth showing.
 */
export function renderDoc(doc: DocBlock | undefined): string | undefined {
  if (!doc) return undefined;
  const prose = sections([deprecatedLine(doc.deprecated), doc.summary || undefined]);
  const tags = sections([
    paramsSection(doc.params),
    returnsLine(doc.returns),
    examplesSection(doc.examples),
  ]);
  return rule([prose || undefined, tags || undefined]) || undefined;
}

function deprecatedLine(deprecated: string | undefined): string | undefined {
  return deprecated && `⚠️ **Deprecated** — ${deprecated}`;
}

function paramsSection(params: readonly DocParam[]): string | undefined {
  if (params.length === 0) return undefined;
  const items = params.map((param) => `- ${code(param.name)}${suffix(param.text)}`);
  return labelled("**Parameters**", items.join("\n"));
}

function suffix(text: string): string {
  return text ? ` — ${text}` : "";
}

function returnsLine(returns: string | undefined): string | undefined {
  return returns && `**Returns** — ${returns}`;
}

function examplesSection(examples: readonly string[]): string | undefined {
  if (examples.length === 0) return undefined;
  return labelled("**Example**", examples.map((example) => fence(example)).join("\n"));
}
