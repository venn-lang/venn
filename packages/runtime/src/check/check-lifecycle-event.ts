import {
  type AstNode,
  buildProblem,
  CODES,
  isLifecycleDecl,
  nearestName,
  type Problem,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * `on banana { … }`, which is a block nothing will ever run.
 *
 * `on` reacts to an event of the run, and the events are a closed list: the
 * grammar takes any word there, so a name nobody fires reads as a handler and
 * behaves as an empty file.
 */
export function checkLifecycleEvent(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isLifecycleDecl(node) || !node.event || EVENTS.has(node.event)) return [];
  const near = nearestName(node.event, [...EVENTS]);
  return [
    {
      ...buildProblem({
        spec: CODES.VN5004_UNKNOWN_EVENT,
        span: nodeSpan(node, ctx.uri),
        title: `There is no run event called "${node.event}".`,
      }),
      help: near ? `Did you mean \`on ${near}\`?` : `The events are: ${[...EVENTS].join(", ")}.`,
    },
  ];
}

/**
 * The events a run has.
 *
 * Two of them are fired today, `failure` and `success`; the rest are named by
 * §13 of the specification and nothing fires them yet. Accepted here either
 * way, because what the language promises is the specification's to say and a
 * lint is not the place to take it back.
 */
const EVENTS = new Set(["failure", "success", "retry", "timeout", "skip", "step"]);
