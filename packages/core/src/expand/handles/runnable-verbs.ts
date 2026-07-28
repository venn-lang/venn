import type { FlowDecl, StepDecl } from "../../generated/ast.js";
import type { VerbTable } from "./handle.types.js";

/**
 * What a flow and a step have beyond the common surface: the sentence they are
 * known by. Read-only, because a title is what the reporter, the `--flow` filter
 * and the trace all key off, and renaming it mid-expansion would leave every one
 * of them pointing at a run nobody asked for.
 */
export const RUNNABLE_VERBS: VerbTable = {
  props: { title: (node) => (node as FlowDecl | StepDecl).title },
  calls: {},
};
