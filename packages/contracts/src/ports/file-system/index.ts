export { fsNotFound } from "./file-system.errors.js";
export { FileSystemPort } from "./file-system.port.js";
export type { DirEntry, FileSystem } from "./file-system.types.js";
export { createMemoryFs } from "./memory-fs.js";
// node-fs is deliberately absent: it lives behind @venn/contracts/node, so this
// barrel stays Worker-safe.
