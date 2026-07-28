import type { Port, SecretProvider } from "@venn-lang/contracts";

/** What an action's `run` receives. Ports are how a plugin reaches I/O. */
export interface ActionContext {
  /**
   * Resolve a port to the implementation the host bound to it.
   *
   * @throws VennError when nothing is bound for that port, or when the host
   * lacks a capability the port requires.
   */
  port<T>(port: Port<T>): T;
  secrets: SecretProvider;
  /** The document's evaluated `config { … }` block (e.g. `baseUrl`). */
  config: Record<string, unknown>;
  /** Aborted when a `race` this action runs inside has already been won. */
  signal?: AbortSignal;
  log(message: string): void;
  redact(value: string): void;
  /**
   * Call a function the flow passed in, as in `http.on server fn (req) => …`.
   *
   * A closure is one of the language's own values, not a JavaScript function, so
   * this is the only way to run one. It waits for whatever the closure reaches
   * for, as everywhere else.
   */
  invoke(fn: unknown, args: readonly unknown[]): unknown;
}

/** What a matcher's `test`/`message` may use. */
export interface MatcherContext {
  log(message: string): void;
}

/** What a resource's `open` receives. */
export interface ResourceContext {
  /**
   * Resolve a port to the implementation the host bound to it.
   *
   * @throws VennError when nothing is bound for that port, or when the host
   * lacks a capability the port requires.
   */
  port<T>(port: Port<T>): T;
  secrets: SecretProvider;
}

/** The evaluated inputs handed to an action: positional args + validated opts. */
export interface ActionInput<P> {
  args: readonly unknown[];
  params: P;
}

/** The evaluated inputs handed to a matcher: the subject + clause args + opts. */
export interface MatcherArgs<P> {
  subject: unknown;
  args: readonly unknown[];
  params: P;
}
