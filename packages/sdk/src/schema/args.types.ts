import type { TypeSpec } from "@venn-lang/types";

/**
 * One positional argument of an action, as the editor needs to present it.
 *
 * The sibling of {@link ParamSpec}, which describes a key of the trailing
 * options map. Between them they say everything a call site needs: `http.post`
 * takes a `url` here and a `body` in the braces.
 *
 * The name is the point. A bare `FnSpec` carries types alone, so the editor
 * could only offer `http.on <dynamic> <dynamic>`, which teaches nobody anything.
 * `http.on server handler` does.
 */
export interface ArgSpec {
  /** What it is called while you type it: `url`, `server`, `handler`. */
  readonly name: string;
  readonly type: TypeSpec;
  /** One line, in the user's domain rather than the implementation's. */
  readonly doc?: string;
  /** Whether the call still means something without it. */
  readonly optional?: boolean;
  /**
   * Whether it takes this one and every argument after it, as in `data.oneOf a b c`.
   * The type vocabulary has no rest parameter, so without this a variadic verb
   * would have to describe itself as taking nothing.
   */
  readonly rest?: boolean;
}
