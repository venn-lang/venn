/**
 * How big the terminal is, in characters. Absent when there is no terminal to
 * ask, which is what a pipe and a log file both look like.
 */
export interface TerminalSize {
  readonly columns: number;
  readonly rows: number;
}

/** Which of the three standard streams a question is about. */
export type Stream = "in" | "out" | "err";

/**
 * One keypress, as a program deciding what to do needs it.
 *
 * `name` is the key itself, lowercased and spelled out for the ones that have no
 * character of their own: `up`, `enter`, `escape`, `backspace`. `text` is what
 * it would have typed, and is empty for those.
 */
export interface Key {
  readonly name: string;
  readonly text: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

/**
 * Something to do to the screen rather than something to write on it.
 *
 * Named operations rather than escape sequences, so the fake console records
 * what was asked for and a test can say "the cursor went home" instead of
 * matching bytes. The real one turns each into the sequence its terminal wants.
 */
export type ScreenOp =
  /** Put the cursor at a column and row, both counting from 1. */
  | { readonly kind: "to"; readonly column: number; readonly row: number }
  /** Move it from where it is. Negative goes left and up. */
  | { readonly kind: "move"; readonly columns: number; readonly rows: number }
  | { readonly kind: "hide" }
  | { readonly kind: "show" }
  /** Clear the line the cursor is on, leaving the cursor where it is. */
  | { readonly kind: "clearLine" }
  /** Clear everything, and put the cursor at the top left. */
  | { readonly kind: "clearScreen" };

/**
 * The program's console: the standard streams, the terminal they may be
 * attached to, and the process arguments.
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
  /** Everything left on standard input, which is how a pipe hands over. */
  readAll(): Promise<string>;
  /**
   * The next keypress, or null at end of input.
   *
   * Asking puts the terminal in raw mode for as long as it takes, so the key
   * arrives as it is pressed rather than when a line is finished, and the
   * terminal is put back the way it was afterwards.
   */
  readKey(): Promise<Key | null>;
  /** The command-line arguments passed after the script path. */
  args(): readonly string[];
  /** How big the terminal is, or nothing when the output is not one. */
  size(): TerminalSize | undefined;
  /**
   * Whether this stream is a terminal.
   *
   * What decides whether to colour, whether to redraw, and whether asking a
   * question makes any sense.
   */
  isTerminal(stream: Stream): boolean;
  /** Move, hide, show, clear. Ignored where there is no terminal to do it to. */
  screen(op: ScreenOp): void;
  /**
   * Call `listen` whenever the terminal is resized.
   *
   * @returns The way to stop listening, which a program that redraws has to keep
   * hold of: a listener nobody removes keeps the process alive.
   */
  onResize(listen: (size: TerminalSize) => void): () => void;
}
