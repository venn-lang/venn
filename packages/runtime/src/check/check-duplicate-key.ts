import { type AstNode, buildProblem, CODES, isMapLit, type Problem } from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * `{ a: 1, a: 2 }`, where the second quietly wins.
 *
 * One of the two was meant and the other was not, and which is which is not
 * something a reader can tell from the line. Nothing about the shape says the
 * later one is the answer, and a map written by hand with the same key twice is
 * a mistake every time.
 */
export function checkDuplicateKey(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isMapLit(node)) return [];
  const problems: Problem[] = [];
  const seen = new Set<string>();
  for (const entry of node.entries) {
    const key = written(entry.key);
    if (key === undefined) continue;
    if (seen.has(key)) problems.push(saidTwice(key, entry, ctx));
    seen.add(key);
  }
  return problems;
}

function saidTwice(key: string, entry: AstNode, ctx: CheckContext): Problem {
  return {
    ...buildProblem({
      spec: CODES.VN5003_DUPLICATE_KEY,
      span: nodeSpan(entry, ctx.uri),
      title: `"${key}" is given twice in this map, and the second one wins.`,
    }),
    help: "Remove one of them.",
  };
}

/** A key as it is written. A spread has none, and is not a key being repeated. */
function written(key: unknown): string | undefined {
  if (typeof key === "string") return key.replace(/^["']|["']$/g, "");
  const word = key as { name?: string } | undefined;
  return word?.name;
}
