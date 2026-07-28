import type { Port } from "@venn-lang/contracts";
import type { BrowserDriver } from "./browser-driver.types.js";

/**
 * The port every `browser` verb reaches through. Requires the `net` capability,
 * so a host without it fails to load the plugin rather than failing mid-run.
 *
 * `methods` must list every method a verb calls. An omission is not checked at
 * load time, so it surfaces as a TypeError mid-run instead of a legible VN2011.
 */
export const BrowserDriverPort: Port<BrowserDriver> = {
  id: "venn.port.browser-driver",
  version: 1,
  requires: ["net"],
  methods: [
    "launch",
    "newContext",
    "visit",
    "click",
    "fill",
    "select",
    "hover",
    "press",
    "upload",
    "download",
    "screenshot",
    "waitFor",
    "waitForUrl",
    "evaluate",
    "frame",
    "clearCookies",
  ],
};
