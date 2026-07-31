import { emitKeypressEvents } from "node:readline";
import { sequenceFor } from "./ansi.js";
import type { Console, Key, Stream, TerminalSize } from "./console.types.js";
import { createLineReader, type Readable } from "./read-lines.js";

/** A stream that may be a terminal, which is the only thing asked of stdout. */
interface Writable {
  write(text: string): unknown;
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  on?(event: string, listen: () => void): unknown;
  off?(event: string, listen: () => void): unknown;
}

/**
 * Where a node console reads and writes. Injectable, so a test can drive the
 * real implementation and read back what a script printed.
 */
export interface ConsoleStreams {
  argv?: readonly string[];
  stdout?: Writable;
  stderr?: Writable;
  /** Where input is read from. Defaults to the process's own standard input. */
  stdin?: Readable;
}

/**
 * The real console: Node's own streams, and the terminal behind them when there
 * is one.
 *
 * stdin is opened on the first read. A script that never asks for input must not
 * hold the process open waiting for a line that never comes, and one that does
 * ask has to be able to wait for a person to type it, terminal or not.
 *
 * @param streams Overrides for stdin, stdout, stderr and argv, each defaulting
 * to the process's own.
 * @returns The console, reading and writing for real.
 */
export function createNodeConsole(streams: ConsoleStreams = {}): Console {
  const input = streams.stdin ?? process.stdin;
  const out = streams.stdout ?? process.stdout;
  const err = streams.stderr ?? process.stderr;
  const lines = createLineReader(input);
  return {
    write: (text) => void out.write(text),
    writeError: (text) => void err.write(text),
    readLine: () => lines.next(),
    readAll: () => lines.rest(),
    readKey: () => nextKey(input),
    args: () => streams.argv ?? [],
    size: () => sizeOf(out),
    isTerminal: (stream) => Boolean(streamOf({ stream, input, out, err }).isTTY),
    screen: (op) => void (out.isTTY && out.write(sequenceFor(op))),
    onResize: (listen) => watchResize(out, listen),
  };
}

function streamOf(args: { stream: Stream; input: Readable; out: Writable; err: Writable }): {
  isTTY?: boolean;
} {
  if (args.stream === "in") return args.input;
  return args.stream === "out" ? args.out : args.err;
}

function sizeOf(out: Writable): TerminalSize | undefined {
  if (!out.isTTY || out.columns === undefined || out.rows === undefined) return undefined;
  return { columns: out.columns, rows: out.rows };
}

/**
 * Node sends `resize` to the stream itself, so listening means holding on to the
 * exact function to remove later: a listener nobody removes keeps the process
 * alive after the program has finished.
 */
function watchResize(out: Writable, listen: (size: TerminalSize) => void): () => void {
  const size = () => {
    const found = sizeOf(out);
    if (found) listen(found);
  };
  out.on?.("resize", size);
  return () => void out.off?.("resize", size);
}

/**
 * One keypress, with the terminal in raw mode for exactly as long as it takes.
 *
 * Raw mode is what makes a key arrive when it is pressed rather than when a line
 * is finished, and leaving it on would swallow the interrupt every terminal user
 * expects, so it goes back the way it was even when the wait is abandoned.
 */
function nextKey(input: Readable): Promise<Key | null> {
  emitKeypressEvents(input);
  const raw = input.isTTY === true;
  if (raw) input.setRawMode?.(true);
  return new Promise<Key | null>((resolve) => {
    const done = (key: Key | null) => {
      input.off?.("keypress", onKey);
      input.off?.("end", onEnd);
      if (raw) input.setRawMode?.(false);
      input.pause?.();
      resolve(key);
    };
    const onKey = (text: string, key: NodeKey | undefined) => done(keyOf(text, key));
    const onEnd = () => done(null);
    input.on?.("keypress", onKey);
    input.on?.("end", onEnd);
    input.resume?.();
  });
}

/** What Node hands over with a keypress, which is nearly what a Key is. */
interface NodeKey {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

/**
 * A keypress as the language reads it.
 *
 * `text` is what the key would have typed and is empty for the ones that type
 * nothing, which is how a program tells `a` from `up` without a table of its own.
 */
function keyOf(text: string, key: NodeKey | undefined): Key {
  const name = key?.name ?? text ?? "";
  return {
    name,
    text: typed(text ?? "", name),
    ctrl: key?.ctrl ?? false,
    alt: key?.meta ?? false,
    shift: key?.shift ?? false,
  };
}

/** A control sequence types nothing, however many bytes it arrived as. */
function typed(text: string, name: string): string {
  if (text.length !== 1) return "";
  return name === "return" || name === "enter" || name === "tab" ? "" : text;
}
