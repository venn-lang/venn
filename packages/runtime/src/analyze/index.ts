/**
 * The front end: parse-and-check, assembled once.
 *
 * It used to be assembled by hand in three places, each choosing its own subset
 * of the passes, so a pass added to one reached only that consumer. `venn run`
 * and `venn test` never type-checked at all, and the editor never reported a
 * name a package does not publish. Every command calls this now, and they
 * differ only in which severities they report and what they exit with.
 */

export type { Analysis, AnalyzeArgs, FrontEnd, FrontEndArgs } from "./analyze.types.js";
export { createFrontEnd } from "./create-front-end.js";
export { NOTHING_IMPORTED } from "./nothing-imported.js";
