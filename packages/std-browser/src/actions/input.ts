import { type ActionDefinition, type ActionInput, arg, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import type { PressArgs } from "../port/index.js";
import { arg0, arg1, browserDriver } from "./support.js";

const uploadParams = z.object({ file: z.string() });

function pressArgs(input: ActionInput<unknown>): PressArgs {
  return input.args.length > 1 ? { selector: arg0(input), key: arg1(input) } : { key: arg0(input) };
}

/**
 * `browser.click "#submit"`.
 *
 * Clicks the matching element, waiting for it to be ready first.
 */
export const click: ActionDefinition = defineAction({
  name: "click",
  doc: "Click the element matching a selector.",
  args: [arg("selector", t.string, "What to act on: a CSS selector, or visible text.")],
  result: t.void,
  run: (ctx, input) => browserDriver(ctx).click(arg0(input)),
});

/**
 * `browser.fill "#email" "ada@example.test"`.
 *
 * Replaces whatever an input holds with the given value.
 */
export const fill: ActionDefinition = defineAction({
  name: "fill",
  doc: "Fill an input with a value.",
  args: [
    arg("selector", t.string, "What to act on: a CSS selector, or visible text."),
    arg("value", t.string, "What to type into it."),
  ],
  result: t.void,
  run: (ctx, input) => browserDriver(ctx).fill({ selector: arg0(input), value: arg1(input) }),
});

/**
 * `browser.select "#country" "BR"`.
 *
 * Picks an option in a dropdown. The second argument is the option's value
 * attribute, not the label the user sees.
 */
export const select: ActionDefinition = defineAction({
  name: "select",
  doc: "Select an option by value.",
  args: [
    arg("selector", t.string, "What to act on: a CSS selector, or visible text."),
    arg("value", t.string, "The option's value, not its label."),
  ],
  result: t.void,
  run: (ctx, input) => browserDriver(ctx).select({ selector: arg0(input), value: arg1(input) }),
});

/**
 * `browser.hover ".menu-trigger"`.
 *
 * Moves the pointer over an element, which is how a hover menu or tooltip is
 * made to appear.
 */
export const hover: ActionDefinition = defineAction({
  name: "hover",
  doc: "Hover over an element.",
  args: [arg("selector", t.string, "What to act on: a CSS selector, or visible text.")],
  result: t.void,
  run: (ctx, input) => browserDriver(ctx).hover(arg0(input)),
});

/**
 * `browser.press "Enter"`, or `browser.press "#search" "Enter"`.
 *
 * Sends a keystroke. Called with one argument, the page has focus and the
 * argument is the key. Called with two, the first is a selector to focus and
 * the second is the key.
 *
 * Both shapes are strings, so a single signature of two strings covers them.
 */
export const press: ActionDefinition = defineAction({
  name: "press",
  doc: "Press a key, optionally focused on a selector.",
  args: [
    arg("key", t.string, "The key to press: `Enter`, `Escape`, `Control+A`."),
    arg("selector", t.string, "What to focus first. Omit it and the page has focus."),
  ],
  result: t.void,
  run: (ctx, input) => browserDriver(ctx).press(pressArgs(input)),
});

/**
 * `browser.upload "#avatar" { file: "./fixtures/face.png" }`.
 *
 * Hands a file to a file input, as picking one in the OS dialog would.
 */
export const upload: ActionDefinition = defineAction({
  name: "upload",
  doc: "Upload a file to a file input.",
  params: uploadParams,
  args: [arg("selector", t.string, "What to act on: a CSS selector, or visible text.")],
  result: t.void,
  run: (ctx, input) =>
    browserDriver(ctx).upload({ selector: arg0(input), file: input.params.file }),
});
