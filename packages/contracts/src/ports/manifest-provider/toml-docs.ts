const COMMENT = /^\s*#\s?(.*)$/;
const KEY = /^\s*([A-Za-z_][\w-]*)\s*=/;

/**
 * The comment block written directly above a key, read as that key's
 * documentation. The same idea as `##` above a declaration in a `.vn`.
 *
 * A blank line breaks the block, so a comment separated from a key belongs to
 * nobody and is never attributed to the next one down.
 *
 * @returns documentation keyed by the key it sits above.
 */
export function tomlDocs(content: string): Record<string, string> {
  const docs: Record<string, string> = {};
  let block: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const comment = COMMENT.exec(line);
    if (comment) {
      block.push(comment[1] ?? "");
      continue;
    }
    const key = KEY.exec(line)?.[1];
    if (key && block.length > 0) docs[key] = block.join("\n").trim();
    block = [];
  }
  return docs;
}
