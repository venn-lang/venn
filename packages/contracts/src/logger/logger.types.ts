/** How loudly one entry asks to be heard. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** One line of log, as data rather than as formatted text. */
export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
}

/** The minimal structured logger a host exposes. */
export interface Logger {
  log(entry: LogEntry): void;
}

/** A {@link Logger} that also retains what it was given, for assertions. */
export interface MemoryLogger extends Logger {
  readonly entries: readonly LogEntry[];
}
