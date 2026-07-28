import { type TypeSpec, t } from "@venn/types";

/**
 * The types `@venn/browser` publishes to the checker, under the `browser`
 * namespace.
 *
 * `Browser` and `Page` are opaque because they are live things, and their
 * insides belong to the driver rather than to a flow. `Download` and
 * `Screenshot` are plain data, mirroring `DownloadResult` and
 * `ScreenshotResult` in `port/browser-driver.types.ts` field by field. No
 * driver method returns an element, so `Element` mirrors `FakeElement` instead.
 */
export const browserTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /** A launched engine. Held, passed to the `browser` verbs, closed by scope. */
  Browser: t.opaque("browser.Browser", { id: t.string, engine: t.string }),
  /** An isolated context: which one it is, and where it currently points. */
  Page: t.opaque("browser.Page", { id: t.string, url: t.string }),
  /**
   * A resolved element: the subject `visible` and `text` match against. The
   * selector is how an element is found, not something it carries, so what the
   * matchers are handed is `{ visible, text, value }`, all three always set.
   */
  Element: t.record({ visible: t.bool, text: t.string, value: t.string }, { open: true }),
  /** What `browser.download` captured: where it landed, and how big it was. */
  Download: t.record({ path: t.string, bytes: t.number }),
  /** What `browser.screenshot` captured, under the name it was asked for. */
  Screenshot: t.record({ name: t.string, path: t.string }),
};
