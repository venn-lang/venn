import type { ParamSpec } from "@venn/sdk";

/**
 * A call as the editor describes it back to whoever is typing it.
 *
 * Deliberately not an LSP type: the same shape answers signature help, hover
 * and the completion detail line, and only one of those speaks LSP.
 */
export interface CallShape {
  /** What is being called: `http.on`, `print`. */
  target: string;
  args: readonly ShownArg[];
  /**
   * The keys the trailing `{ … }` accepts, empty when it accepts none.
   *
   * The options are an argument like any other, the last one and a map, so they
   * are described here rather than flagged with a boolean. A reader halfway
   * through `http.get(url, ` is asking exactly what may go next.
   */
  options: readonly ParamSpec[];
  doc?: string;
  /** Prose for what comes back, when the author wrote any. */
  returns?: string;
}

export interface ShownArg {
  name: string;
  /** The type as text: `string`, `HttpServer`, `fn(request) -> reply`. */
  type: string;
  doc?: string;
  optional?: boolean;
  /** Takes this one and every argument after it. */
  rest?: boolean;
}
