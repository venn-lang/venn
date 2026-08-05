import process from "node:process";
import { errorLine } from "../reporters/index.js";
import { hungUp } from "./quiet-pipe.js";
import type { Leave, Unregister } from "./shutdown.types.js";

/**
 * The two ways a program dies without being asked to.
 *
 * Node's default for both is to print a stack and vanish, losing the sockets,
 * the reason and the exit code at once. Catching them means the failure is
 * stated in the language's own voice and the machine gets its resources back on
 * the way out.
 */
export function installFaultHooks(args: {
  leave: Leave;
  report?: (message: string) => void;
}): Unregister {
  const onFault = (cause: unknown) => fault({ ...args, cause });
  process.on("uncaughtException", onFault);
  process.on("unhandledRejection", onFault);
  return () => {
    process.off("uncaughtException", onFault);
    process.off("unhandledRejection", onFault);
  };
}

function fault(args: { leave: Leave; report?: (message: string) => void; cause: unknown }): void {
  // A reader that hung up is not a fault. It reaches here only when a write
  // threw where the stream's own `error` had no chance to run, and saying
  // `EPIPE: broken pipe, write` to a terminal nobody is reading is worse than
  // saying nothing.
  if (hungUp(args.cause)) {
    args.leave(0);
    return;
  }
  const write = args.report ?? ((message: string) => process.stderr.write(`${message}\n`));
  write(errorLine(args.cause));
  args.leave(1);
}
