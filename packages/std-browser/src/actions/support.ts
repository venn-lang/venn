import type { ActionContext, ActionInput } from "@venn-lang/sdk";
import { type BrowserDriver, BrowserDriverPort } from "../port/index.js";

/** The browser driver bound to this run. */
export function browserDriver(ctx: ActionContext): BrowserDriver {
  return ctx.port(BrowserDriverPort);
}

/** The first positional argument as a string. A missing one reads as `""`. */
export function arg0(input: ActionInput<unknown>): string {
  return String(input.args[0] ?? "");
}

/** The second positional argument as a string. A missing one reads as `""`. */
export function arg1(input: ActionInput<unknown>): string {
  return String(input.args[1] ?? "");
}
