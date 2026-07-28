import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileSystemConformance } from "./file-system.suite.js";
import { createMemoryFs } from "./memory-fs.js";
import { createNodeFs } from "./node-fs.js";

fileSystemConformance({ name: "memory", factory: () => createMemoryFs() });

fileSystemConformance({
  name: "node-fs",
  factory: async () => createNodeFs({ root: await mkdtemp(join(tmpdir(), "venn-fs-")) }),
});
