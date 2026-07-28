/**
 * The program's console: standard streams and process arguments.
 *
 * Everything a script needs to talk to the outside world without knowing
 * whether it runs on Node, in a test, or in a browser worker. The host supplies
 * the wiring.
 */
export interface Console {
  /** Write to standard output, exactly as given (no trailing newline). */
  write(text: string): void;
  /** Write to standard error. */
  writeError(text: string): void;
  /** Read the next line from standard input, or null at end of input. */
  readLine(): Promise<string | null>;
  /** The command-line arguments passed after the script path. */
  args(): readonly string[];
}
