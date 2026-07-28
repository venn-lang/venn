/** What to run, where, and how to hear from it while it runs. */
export interface SpawnArgs {
  command: string;
  args?: readonly string[];
  /** Where it runs. The current directory unless this says otherwise. */
  cwd?: string;
  /** Added to the environment the host was started with. */
  env?: Record<string, string>;
  /**
   * Whether to go through the platform shell.
   *
   * Needed for a command that is a script rather than an executable: on Windows
   * `pnpm` is a `.cmd`, and nothing runs it without one. Off by default,
   * because a shell re-reads the arguments and a quote that meant one thing to
   * the caller means another to `cmd.exe`. Only the caller knows which of the
   * two it is holding.
   */
  shell?: boolean;
  /**
   * Called with each chunk the command writes, as it writes it.
   *
   * A package manager installing a hundred packages takes half a minute, and a
   * command silent for half a minute reads as one that has hung. What is
   * streamed here is kept as well, so a caller can show it and read it after.
   */
  onOutput?: (chunk: string) => void;
}

/** How a run ended. */
export interface ProcessResult {
  code: number;
  /** Everything it wrote, stdout and stderr together, in the order written. */
  output: string;
}

/** A spawned subprocess. */
export interface ProcessHandle {
  readonly pid: number;
  /** Resolves when the command ends. Never rejects: a failure is a result. */
  wait(): Promise<ProcessResult>;
  kill(): void;
}

/** Spawn subprocesses: a package manager, a driver, anything the host allows. */
export interface ProcessProvider {
  spawn(args: SpawnArgs): ProcessHandle;
}
