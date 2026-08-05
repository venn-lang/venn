import process from "node:process";
import type { Unregister } from "./shutdown.types.js";

/** Every way a reader hanging up reaches a Node program. */
const HUNG_UP: Record<string, true> = {
  EPIPE: true,
  ERR_STREAM_DESTROYED: true,
  ERR_STREAM_WRITE_AFTER_END: true,
};

/**
 * Whether this is the reader leaving rather than the program going wrong.
 *
 * @param cause Anything thrown, or anything a stream reported.
 * @returns True when the other end of a pipe is gone.
 */
export function hungUp(cause: unknown): boolean {
  const code = (cause as { code?: unknown } | null)?.code;
  return typeof code === "string" && HUNG_UP[code] === true;
}

/**
 * `venn run prog.vn | head -2`.
 *
 * `head` reads its two lines and closes the pipe, and every write after that
 * fails. Node raises it as an uncaught exception, so a program written in Venn
 * ended the first time anybody piped it into `head` or `less`, printing
 * `EPIPE: broken pipe, write` and leaving with 1. That is the first thing a
 * person does to a program that prints.
 *
 * Nothing is said, and the exit is 0, which is what a well-behaved CLI does: the
 * reader got what it asked for and stopped asking, and that is not the program
 * failing. Leaving at once rather than carrying on matters too, since the rest
 * of the output has nowhere left to go.
 *
 * Both streams, because `2>&1 | head` closes both, and `SIGPIPE` as well, for
 * the platform that delivers the signal instead of the error.
 *
 * @param args.exit How the program leaves. Injected so a test can watch instead
 * of dying.
 * @returns The way to take all of it back off the process.
 */
export function quietPipe(args: { exit: (code: number) => void }): Unregister {
  const leave = (cause: unknown) => {
    if (hungUp(cause)) args.exit(0);
  };
  const onSignal = () => args.exit(0);
  process.stdout.on("error", leave);
  process.stderr.on("error", leave);
  process.on("SIGPIPE", onSignal);
  return () => {
    process.stdout.off("error", leave);
    process.stderr.off("error", leave);
    process.off("SIGPIPE", onSignal);
  };
}
