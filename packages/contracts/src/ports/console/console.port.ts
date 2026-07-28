import type { Port } from "../../port/index.js";
import type { Console } from "./console.types.js";

/**
 * The {@link Console} contract. Implementations: `node-console`,
 * `memory-console`.
 */
export const ConsolePort: Port<Console> = {
  id: "venn.port.console",
  version: 1,
  requires: ["io"],
  methods: ["write", "writeError", "readLine", "args"],
};
