import type { ActionDefinition } from "@venn/sdk";
import { download, evaluate, screenshot } from "./capture.js";
import { frame } from "./frame.js";
import { click, fill, hover, press, select, upload } from "./input.js";
import { clearCookies, launch, newContext, visit, waitForUrl } from "./navigation.js";
import { waitFor } from "./wait.js";

/** Every verb in the `browser` namespace, in the order the plugin registers them. */
export const browserActions: ActionDefinition[] = [
  launch,
  visit,
  click,
  fill,
  select,
  hover,
  press,
  upload,
  download,
  screenshot,
  waitFor,
  waitForUrl,
  evaluate,
  frame,
  newContext,
  clearCookies,
];
