import type { HostCapability } from "@venn-lang/contracts";
import type { TypeSpec } from "@venn-lang/types";
import type { ZodType } from "zod";
import type { ActionDefinition } from "./action.types.js";
import type { DecoratorDefinition } from "./decorator.types.js";
import type { MatcherDefinition } from "./matcher.types.js";
import type { ValueDefinition } from "./value.types.js";

/** Everything a plugin contributes. The registry ingests this shape. */
export interface PluginDefinition {
  name: string;
  version: string;
  /** The prefix every verb of this plugin is written under: `http` in `http.get`. */
  namespace: string;
  /** Host capabilities without which loading fails, with a diagnostic, before any run. */
  requires?: readonly HostCapability[];
  actions?: readonly ActionDefinition[];
  /**
   * The constants this namespace publishes: `math.pi`, and anything else that is
   * data rather than something to call.
   *
   * A verb with no arguments would have to be written `math.pi()`, and reading
   * one without the brackets hands back the verb itself. A value is read as what
   * it is.
   */
  values?: readonly ValueDefinition[];
  matchers?: readonly MatcherDefinition[];
  /** The `@name`s this plugin contributes, run over the tree before anything reads it. */
  decorators?: readonly DecoratorDefinition[];
  /** Nominal data types as Zod schemas, for a plugin that validates its own values. */
  types?: Readonly<Record<string, ZodType>>;
  /**
   * The named types this plugin's signatures refer to, by short name: `Request`
   * is reachable from a flow as `http.Request`. This is what the checker and the
   * editor read.
   */
  typeDefs?: Readonly<Record<string, TypeSpec>>;
}
