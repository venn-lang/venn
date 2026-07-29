/** What a version directory offers to be run. */
export type EntryKind =
  /** The language itself: commands, compiler, runtime. */
  | "run"
  /** The language server, for an editor. */
  | "lsp";

/** What the orchestrator should do about a directory, once it has looked. */
export type Plan =
  /** Everything is here. Hand over to this. */
  | { readonly kind: "run"; readonly version: string; readonly entry: string }
  /** Nothing installed answers, and this one would. Fetch it, then hand over. */
  | { readonly kind: "install"; readonly request: string; readonly reason: string }
  /** Nothing can be done, and this says why in a sentence. */
  | { readonly kind: "stop"; readonly reason: string };
