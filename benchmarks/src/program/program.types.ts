/** A `.vn` file, parsed once and ready to run over and over. */
export interface Program {
  /** Run the program once, resolving to what it printed. */
  execute(): Promise<string>;
  /** Milliseconds spent parsing and type-checking, measured once. */
  compileMs: number;
}
