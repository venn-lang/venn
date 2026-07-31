import type { Port } from "../../port/index.js";
import type { Paths } from "./paths.types.js";

/**
 * The {@link Paths} contract. Implementations: `posix-paths`, `windows-paths`.
 *
 * It requires no capability. Working out where a path leads is text, not I/O,
 * so the editor's worker answers the same questions the CLI does.
 */
export const PathsPort: Port<Paths> = {
  id: "venn.port.paths",
  version: 1,
  requires: [],
  methods: [
    "cwd",
    "join",
    "resolve",
    "relative",
    "normalize",
    "dirname",
    "basename",
    "extension",
    "isAbsolute",
    "split",
  ],
};
