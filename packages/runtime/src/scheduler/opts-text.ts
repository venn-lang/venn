import { evaluate, type MapLit } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";

/** Read a string field from an options map literal (e.g. `{ onError: "cancel" }`). */
export function optsText(opts: MapLit | undefined, key: string, scope: Scope): string | undefined {
  const entry = opts?.entries.find((candidate) => candidate.key === key);
  if (!entry) return undefined;
  const value = evaluate(entry.value, scope);
  return typeof value === "string" ? value : undefined;
}
