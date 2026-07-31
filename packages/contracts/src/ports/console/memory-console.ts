import type { Console, Key, ScreenOp, Stream, TerminalSize } from "./console.types.js";

/** A {@link Console} that keeps its transcript instead of printing it. */
export interface MemoryConsole extends Console {
  readonly out: string;
  readonly err: string;
  /** Every screen operation asked for, in order, rather than as escape codes. */
  readonly ops: readonly ScreenOp[];
  /** Pretend the terminal was resized, so a program that redraws can be tested. */
  resize(size: TerminalSize): void;
}

/** What a fake console is set up with: what it reads, and what it looks like. */
export interface MemoryConsoleArgs {
  /** The lines `readLine` hands back, in order. */
  input?: readonly string[];
  /** The keys `readKey` hands back, in order. */
  keys?: readonly Partial<Key>[];
  argv?: readonly string[];
  /** Absent means no terminal, which is what a pipe looks like. */
  size?: TerminalSize;
  /** Which streams are terminals. None of them, unless said otherwise. */
  terminal?: readonly Stream[];
}

interface State {
  out: string;
  err: string;
  ops: ScreenOp[];
  size: TerminalSize | undefined;
  listeners: ((size: TerminalSize) => void)[];
}

/**
 * The double: records what was written and what was asked of the screen, and
 * reads from a scripted input.
 *
 * The recording is what makes a terminal testable. A program that redraws is
 * checked by what it asked for rather than by the bytes one terminal happens to
 * want, and `resize` arranges the one thing a test otherwise cannot.
 *
 * @param args What it reads back, what it reports as arguments, and what it
 * looks like: its size, and which streams are terminals.
 * @returns The console, plus the transcript and the operations it recorded.
 */
export function createMemoryConsole(args: MemoryConsoleArgs = {}): MemoryConsole {
  const state: State = { out: "", err: "", ops: [], size: args.size, listeners: [] };
  const input = [...(args.input ?? [])];
  const keys = [...(args.keys ?? [])];
  const terminals = new Set(args.terminal ?? []);
  return {
    write: (text) => {
      state.out += text;
    },
    writeError: (text) => {
      state.err += text;
    },
    readLine: () => Promise.resolve(input.length > 0 ? (input.shift() ?? null) : null),
    readAll: () => Promise.resolve(input.splice(0).join("\n")),
    readKey: () => Promise.resolve(keys.length > 0 ? keyOf(keys.shift()) : null),
    args: () => args.argv ?? [],
    size: () => state.size,
    isTerminal: (stream) => terminals.has(stream),
    screen: (op) => {
      state.ops.push(op);
    },
    onResize: (listen) => {
      state.listeners.push(listen);
      return () => void state.listeners.splice(state.listeners.indexOf(listen), 1);
    },
    resize: (size) => {
      state.size = size;
      for (const listen of [...state.listeners]) listen(size);
    },
    get out() {
      return state.out;
    },
    get err() {
      return state.err;
    },
    get ops() {
      return [...state.ops];
    },
  };
}

/** A scripted key, filled in: a test writes `{ name: "up" }` and means it. */
function keyOf(key: Partial<Key> | undefined): Key {
  return {
    name: key?.name ?? "",
    text: key?.text ?? "",
    ctrl: key?.ctrl ?? false,
    alt: key?.alt ?? false,
    shift: key?.shift ?? false,
  };
}
