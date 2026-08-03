import type { Port } from "../../port/index.js";
import type { Random } from "./random.types.js";

/**
 * The {@link Random} contract. Implementations: `seeded-random`,
 * `fixed-random`.
 */
export const RandomPort: Port<Random> = {
  id: "venn.port.random",
  version: 1,
  requires: ["random"],
  methods: ["next", "int", "restart"],
};
