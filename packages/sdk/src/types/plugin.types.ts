import type { HostCapability } from "@venn-lang/contracts";
import type { TypeSpec } from "@venn-lang/types";
import type { ActionDefinition } from "./action.types.js";
import type { DecoratorDefinition } from "./decorator.types.js";
import type { MatcherDefinition } from "./matcher.types.js";
import type { ValueDefinition } from "./value.types.js";

/** Everything a plugin contributes. The registry ingests this shape. */
export interface PluginDefinition {
  name: string;
  /** The prefix every verb of this plugin is written under: `http` in `http.get`. */
  namespace: string;
  /** Host capabilities without which loading fails, with a diagnostic, before any run. */
  requires?: readonly HostCapability[];
  /**
   * Whatever this plugin keeps between calls, given back before every flow.
   *
   * State that outlives a flow makes the flow's answers depend on which flows
   * ran before it: a frozen clock, an interceptor or a feature flag left
   * standing is a lie the next flow reads back. A plugin that keeps nothing
   * leaves this out, which is most of them.
   */
  atFlowStart?: () => void;
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
  /**
   * The named types this plugin's signatures refer to, by short name: `Request`
   * is reachable from a flow as `http.Request`. This is what the checker and the
   * editor read.
   */
  typeDefs?: Readonly<Record<string, TypeSpec>>;
}
