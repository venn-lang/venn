import type { Console } from "./console.types.js";

/** A {@link Console} that keeps its transcript instead of printing it. */
export interface MemoryConsole extends Console {
  readonly out: string;
  readonly err: string;
}

/**
 * The double: records what was written, reads from a scripted input.
 *
 * @param args.input - the lines `readLine` hands back, in order.
 * @param args.argv - what `args()` reports.
 */
export function createMemoryConsole(
  args: { input?: readonly string[]; argv?: readonly string[] } = {},
): MemoryConsole {
  const state = { out: "", err: "" };
  const input = [...(args.input ?? [])];
  return {
    write: (text) => {
      state.out += text;
    },
    writeError: (text) => {
      state.err += text;
    },
    readLine: () => Promise.resolve(input.length > 0 ? (input.shift() ?? null) : null),
    args: () => args.argv ?? [],
    get out() {
      return state.out;
    },
    get err() {
      return state.err;
    },
  };
}
