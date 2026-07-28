import process from "node:process";
import { errorLine } from "../reporters/index.js";
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
  const write = args.report ?? ((message: string) => process.stderr.write(`${message}\n`));
  write(errorLine(args.cause));
  args.leave(1);
}
