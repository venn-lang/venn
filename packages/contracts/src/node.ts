// @venn/contracts/node: the corner backed by `node:*`. Only Node consumers (the
// CLI) import this; the main entry stays neutral so it runs in a Web Worker.

export { createNodeHost } from "./host/create-node-host.js";
export { type ConsoleStreams, createNodeConsole } from "./ports/console/node-console.js";
export { createNodeFs } from "./ports/file-system/node-fs.js";
export { createNodeSpawn } from "./ports/process-provider/node-spawn.js";
export { createNodeSignals, isKnownSignal } from "./ports/signal-source/node-signals.js";
