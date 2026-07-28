// The Console port lives in @venn/contracts: it is a host capability like the
// file system or the clock, not something this plugin owns.
export { type Console, ConsolePort, createMemoryConsole } from "@venn/contracts";
