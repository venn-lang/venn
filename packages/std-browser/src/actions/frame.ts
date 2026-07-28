import { type ActionDefinition, arg, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import { arg0, browserDriver } from "./support.js";

/**
 * `browser.frame "payment-iframe"`.
 *
 * Points the following steps at an iframe, by its name or a selector for it.
 * Selectors do not cross a frame boundary, so anything inside one needs this
 * first.
 */
export const frame: ActionDefinition = defineAction({
  name: "frame",
  doc: "Enter an iframe by name or selector for nested steps.",
  args: [arg("name", t.string, "The iframe's name, or a selector for it.")],
  result: t.void,
  run: (ctx, input) => browserDriver(ctx).frame({ name: arg0(input) }),
});
