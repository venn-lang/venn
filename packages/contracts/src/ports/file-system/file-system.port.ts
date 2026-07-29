import type { Port } from "../../port/index.js";
import type { FileSystem } from "./file-system.types.js";

/**
 * The {@link FileSystem} contract. Implementations: `node-fs`, `memory-fs`.
 */
export const FileSystemPort: Port<FileSystem> = {
  id: "venn.port.filesystem",
  version: 1,
  requires: ["fs"],
  methods: ["read", "write", "exists", "remove", "removeAll", "list"],
};
