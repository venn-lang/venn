import { type ActionDefinition, arg, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import { arg0, browserDriver } from "./support.js";

/**
 * `browser.screenshot "checkout-empty"`.
 *
 * Captures the page as it stands and files it under the given name.
 *
 * @returns a `browser.Screenshot` saying where the image landed.
 */
export const screenshot: ActionDefinition = defineAction({
  name: "screenshot",
  doc: "Capture a screenshot by name.",
  args: [arg("name", t.string, "What to file it under.")],
  result: t.ref("browser.Screenshot"),
  run: (ctx, input) => browserDriver(ctx).screenshot(arg0(input)),
});

/**
 * `browser.download "#invoice-pdf"`.
 *
 * Clicks something that starts a download and waits for the file to land.
 *
 * @returns a `browser.Download` saying where the file landed and how big it is.
 */
export const download: ActionDefinition = defineAction({
  name: "download",
  doc: "Trigger and capture a download from a selector.",
  args: [arg("selector", t.string, "What to act on: a CSS selector, or visible text.")],
  result: t.ref("browser.Download"),
  run: (ctx, input) => browserDriver(ctx).download({ selector: arg0(input) }),
});

/**
 * `browser.evaluate "document.title"`.
 *
 * Runs JavaScript inside the page and hands back what it evaluated to. The
 * escape hatch for whatever the other verbs cannot reach.
 *
 * The result is `dynamic`: narrowing it would be a guess about someone else's
 * script.
 */
export const evaluate: ActionDefinition = defineAction({
  name: "evaluate",
  doc: "Evaluate a script in the page and return its value.",
  args: [arg("script", t.string, "JavaScript to run in the page.")],
  result: t.dynamic,
  run: (ctx, input) => browserDriver(ctx).evaluate({ script: arg0(input) }),
});
