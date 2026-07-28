import type { Port } from "../../port/index.js";
import type { SignalSource } from "./signal-source.types.js";

/**
 * The {@link SignalSource} contract. Implementations: `node-signals`,
 * `fake-signals`.
 */
export const SignalSourcePort: Port<SignalSource> = {
  id: "venn.port.signals",
  version: 1,
  requires: ["process"],
  methods: ["on"],
};
