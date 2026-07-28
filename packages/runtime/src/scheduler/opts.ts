import { evaluate, type MapLit } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";

/** Read a numeric field from an options map literal (e.g. `{ concurrency: 4 }`). */
export function optsNumber(
  opts: MapLit | undefined,
  key: string,
  scope: Scope,
): number | undefined {
  const entry = opts?.entries.find((candidate) => candidate.key === key);
  if (!entry) return undefined;
  const value = evaluate(entry.value, scope);
  return typeof value === "number" ? value : undefined;
}
