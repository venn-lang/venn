import { createInterface, type Interface } from "node:readline";
import type { Console } from "./console.types.js";

/**
 * Where a node console reads and writes. Injectable, so a test can drive the
 * real implementation and read back what a script printed.
 */
export interface ConsoleStreams {
  argv?: readonly string[];
  stdout?: { write(text: string): unknown };
  stderr?: { write(text: string): unknown };
  /** Where lines are read from. Defaults to the process's own standard input. */
  stdin?: NodeJS.ReadableStream & { isTTY?: boolean };
}

/**
 * The real console: Node's own streams.
 *
 * stdin is opened lazily, on the first `readLine`. A script that never reads
 * input must not hold the process open waiting for a line that never comes.
 *
 * @param streams - overrides for stdin, stdout, stderr and argv. Each defaults
 * to the process's own.
 */
export function createNodeConsole(streams: ConsoleStreams = {}): Console {
  const lines = createLineReader(streams.stdin ?? process.stdin);
  const out = streams.stdout ?? process.stdout;
  const err = streams.stderr ?? process.stderr;
  return {
    write: (text) => void out.write(text),
    writeError: (text) => void err.write(text),
    readLine: () => lines.next(),
    args: () => streams.argv ?? [],
  };
}

interface LineReaderState {
  buffered: string[];
  waiting: ((line: string | null) => void)[];
  done: boolean;
  input: NodeJS.ReadableStream & { isTTY?: boolean };
  reader?: Interface;
}

function createLineReader(input: NodeJS.ReadableStream & { isTTY?: boolean }): {
  next(): Promise<string | null>;
} {
  const state: LineReaderState = { buffered: [], waiting: [], done: false, input };
  return { next: () => next(state) };
}

function next(state: LineReaderState): Promise<string | null> {
  open(state);
  if (state.buffered.length > 0) return Promise.resolve(state.buffered.shift() ?? null);
  if (state.done) return Promise.resolve(null);
  return new Promise((resolve) => state.waiting.push(resolve));
}

/** Attach to stdin on the first read; a TTY with no piped input ends at once. */
function open(state: LineReaderState): void {
  if (state.reader || state.done) return;
  if (state.input.isTTY) {
    state.done = true;
    return;
  }
  state.reader = createInterface({ input: state.input, crlfDelay: Number.POSITIVE_INFINITY });
  state.reader.on("line", (line) => deliver(state, line));
  state.reader.on("close", () => finish(state));
}

function deliver(state: LineReaderState, line: string): void {
  const resolve = state.waiting.shift();
  if (resolve) resolve(line);
  else state.buffered.push(line);
}

function finish(state: LineReaderState): void {
  state.done = true;
  for (const resolve of state.waiting.splice(0)) resolve(null);
}
