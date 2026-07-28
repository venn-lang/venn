import type { ProcessHandle, ProcessProvider } from "./process-provider.types.js";

/**
 * The double: a scripted process that never touches the OS.
 *
 * Output is streamed before the wait resolves, exactly as the real one does it,
 * so a caller that shows progress is exercised here and not only against a real
 * machine.
 *
 * @param args.exitCode - what every run reports. Defaults to 0.
 * @param args.output - what every run writes. Defaults to nothing.
 */
export function createFakeProcess(
  args: { exitCode?: number; output?: string } = {},
): ProcessProvider {
  const code = args.exitCode ?? 0;
  const output = args.output ?? "";
  return {
    spawn: (spawned) => {
      if (output !== "") spawned.onOutput?.(output);
      return handle(code, output);
    },
  };
}

function handle(code: number, output: string): ProcessHandle {
  return {
    pid: 0,
    wait: async () => ({ code, output }),
    kill: () => {},
  };
}
