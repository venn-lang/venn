import type { LangiumCoreServices } from "langium";
import { createVennServices } from "./venn-module.js";

let cached: LangiumCoreServices | undefined;

/**
 * The Langium core services that `parse()` uses, built once on first call.
 * Constructing the Chevrotain parser is the expensive part of a first parse,
 * so it must not happen per document.
 */
export function vennServices(): LangiumCoreServices {
  cached ??= createVennServices();
  return cached;
}
