/** A fenced `venn` block: the signature line at the top of a hover. */
export function fence(source: string): string {
  return ["```venn", source, "```"].join("\n");
}

/** An inline code span. */
export function code(text: string): string {
  return `\`${text}\``;
}

/**
 * Hovers read best with three levels of separation, strongest to weakest:
 *
 * - {@link rule}: a horizontal line between the signature, the body and the
 *   provenance footer. This is what VS Code's own hovers use.
 * - {@link sections}: a blank line between blocks inside the body.
 * - a plain newline: a label and the content it introduces stay glued together.
 *
 * The blank line before `---` matters: markdown would otherwise read it as a
 * setext heading and turn the preceding paragraph into an `<h2>`.
 */
export function rule(parts: Array<string | undefined>): string {
  return present(parts).join("\n\n---\n\n");
}

/** Join the blocks that exist, separated by blank lines. */
export function sections(parts: Array<string | undefined>): string {
  return present(parts).join("\n\n");
}

/** Glue a label to the content it introduces, with no gap between them. */
export function labelled(label: string, content: string): string {
  return `${label}\n${content}`;
}

function present(parts: Array<string | undefined>): string[] {
  return parts.filter((part): part is string => Boolean(part));
}
