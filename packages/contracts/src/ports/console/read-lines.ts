import { createInterface, type Interface } from "node:readline";

/** What reading needs of standard input, terminal or pipe alike. */
export interface Readable extends NodeJS.ReadableStream {
  isTTY?: boolean;
  setRawMode?(on: boolean): unknown;
}

/** Lines as they arrive, and everything that is left when that is what is wanted. */
export interface LineReader {
  /** The next line, or null once the input has ended. */
  next(): Promise<string | null>;
  /** Everything still to come, joined by newlines, which is how a pipe hands over. */
  rest(): Promise<string>;
}

const NEWLINE = String.fromCharCode(10);

interface State {
  buffered: string[];
  waiting: ((line: string | null) => void)[];
  done: boolean;
  input: Readable;
  reader?: Interface;
}

/**
 * Read standard input a line at a time, from a pipe or from a person.
 *
 * Opened on the first read rather than on creation, so a script that never asks
 * for input does not hold the process open. A terminal is read like anything
 * else: waiting for someone to type is the point of asking.
 *
 * @param input Where lines come from.
 * @returns The reader, which opens the stream when it is first asked.
 */
export function createLineReader(input: Readable): LineReader {
  const state: State = { buffered: [], waiting: [], done: false, input };
  return { next: () => next(state), rest: () => rest(state) };
}

function next(state: State): Promise<string | null> {
  open(state);
  if (state.buffered.length > 0) return Promise.resolve(state.buffered.shift() ?? null);
  if (state.done) return Promise.resolve(null);
  return new Promise((resolve) => state.waiting.push(resolve));
}

/** Everything to the end of the input, which is what a pipe is usually for. */
async function rest(state: State): Promise<string> {
  const lines: string[] = [];
  for (;;) {
    const line = await next(state);
    if (line === null) return lines.join(NEWLINE);
    lines.push(line);
  }
}

function open(state: State): void {
  if (state.reader || state.done) return;
  state.reader = createInterface({ input: state.input, crlfDelay: Number.POSITIVE_INFINITY });
  state.reader.on("line", (line) => deliver(state, line));
  state.reader.on("close", () => finish(state));
}

function deliver(state: State, line: string): void {
  const resolve = state.waiting.shift();
  if (resolve) resolve(line);
  else state.buffered.push(line);
}

function finish(state: State): void {
  state.done = true;
  state.reader?.close();
  for (const resolve of state.waiting.splice(0)) resolve(null);
}
