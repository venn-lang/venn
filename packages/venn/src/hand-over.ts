import { spawn } from "node:child_process";

/**
 * Runs the language, and gets out of the way.
 *
 * Spawned rather than linked. A symlink on Windows needs a privilege that is
 * not always granted, and a shim that rewrites `PATH` is a thing to debug on
 * somebody else's machine. Spawning is boring and works everywhere.
 *
 * `stdio: "inherit"` hands over the terminal itself rather than piping it. A
 * test run prints as it goes, a reporter may be waiting on the other end, and
 * anything reading from standard input has to reach the language rather than
 * this. It also leaves the language talking to a real terminal, so it still
 * knows to use colour.
 *
 * @param entry The file to run, from the plan.
 * @param args Everything after the command name, passed through untouched.
 * @returns The exit code, which is what CI reads.
 */
export function handOver(args: { entry: string; args: readonly string[] }): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [args.entry, ...args.args], { stdio: "inherit" });
    forwardSignals(child);
    child.on("error", () => resolve(1));
    child.on("close", (code, signal) => resolve(exitCodeFor({ code, signal })));
  });
}

/**
 * Ctrl-C reaches the language, not only this.
 *
 * Both processes share the terminal, so the platform already delivers the
 * signal to both on a normal interrupt. This is for the rest: a supervisor
 * stopping a container, a test harness terminating the run. Without it, the
 * orchestrator dies and leaves the language running with nothing waiting.
 */
function forwardSignals(child: { kill(signal: NodeJS.Signals): boolean }): void {
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }
}

/**
 * A process killed by a signal has no exit code, and reporting 0 would tell CI
 * that an interrupted run passed. The shell convention is 128 plus the signal.
 */
function exitCodeFor(args: { code: number | null; signal: NodeJS.Signals | null }): number {
  if (args.code !== null) return args.code;
  return args.signal === "SIGINT" ? 130 : 143;
}
