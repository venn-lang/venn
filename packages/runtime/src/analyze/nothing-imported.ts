import type { ImportGraph } from "../scheduler/index.js";

/**
 * The graph of a file that reaches nothing: an inline snippet, or a host with
 * no way to read a neighbour.
 *
 * A caller with no module reader used to skip the import check altogether, and
 * with it the half that needs no reader at all: a name a package does not
 * publish is knowable from the registry alone.
 */
export const NOTHING_IMPORTED: ImportGraph = {
  modules: new Map(),
  resolve: (_from: string, spec: string) => spec,
};
