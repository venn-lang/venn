// The `io` namespace: standard input, standard error and process arguments.
// Plain `print` needs no import: it is in the prelude.
export { consoleActions } from "./actions/console-actions.js";
export { ioPlugin, ioPlugin as default } from "./plugin.js";
export { type Console, ConsolePort, createMemoryConsole } from "./port/index.js";
