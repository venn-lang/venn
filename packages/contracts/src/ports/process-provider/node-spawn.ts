import { type ChildProcess, spawn } from "node:child_process";
import type {
  ProcessHandle,
  ProcessProvider,
  ProcessResult,
  SpawnArgs,
} from "./process-provider.types.js";

/**
 * The real one, on `node:child_process`.
 *
 * Output is streamed to whoever asked and kept at the same time: a package
 * manager needs watching while it works and reading once it is done, and only
 * one of the two would leave either a command that looks hung or a result
 * nobody can inspect.
 */
export function createNodeSpawn(): ProcessProvider {
  return { spawn: (args) => start(args) };
}

function start(args: SpawnArgs): ProcessHandle {
  const child = spawn(args.command, [...(args.args ?? [])], {
    cwd: args.cwd,
    env: args.env ? { ...process.env, ...args.env } : process.env,
    shell: args.shell ?? false,
  });
  const chunks: string[] = [];
  listen(child, chunks, args.onOutput);
  return { pid: child.pid ?? 0, wait: () => ended(child, chunks), kill: () => void child.kill() };
}

function listen(child: ChildProcess, into: string[], onOutput?: (chunk: string) => void): void {
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      into.push(text);
      onOutput?.(text);
    });
  }
}

/**
 * A command that could never start reads as one that ran and failed, with the
 * reason as its output, because that is what a caller can act on. `127` is what
 * a shell says for "no such command", and it means the same here.
 */
function ended(child: ChildProcess, chunks: string[]): Promise<ProcessResult> {
  return new Promise((resolve) => {
    child.on("error", (err) => resolve({ code: 127, output: `${chunks.join("")}${err.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 0, output: chunks.join("") }));
  });
}
