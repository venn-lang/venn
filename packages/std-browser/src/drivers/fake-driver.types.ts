import type { BrowserDriver } from "../port/index.js";

/** The in-memory model of one DOM element, as the matchers see it. */
export interface FakeElement {
  visible: boolean;
  text: string;
  value: string;
}

/** One recorded `fill` or `select` call. */
export interface FillRecord {
  selector: string;
  value: string;
}

/** Everything the fake driver records, so a test can assert on what a flow did. */
export interface FakeBrowserState {
  url: string;
  /** Every URL visited, in order. `visit` and `waitForUrl` both append. */
  history: string[];
  clicks: string[];
  fills: FillRecord[];
  /** The iframe currently entered, or `undefined` at the top level. */
  frame: string | undefined;
  cookiesCleared: number;
  /** What `evaluate` resolves to, whatever the script says. */
  evalResult: unknown;
  elements: Map<string, FakeElement>;
}

/** What to preload the fake driver's page with. */
export interface FakeDriverOptions {
  /** Elements by selector. Missing fields default to visible with empty text. */
  elements?: Record<string, Partial<FakeElement>>;
  url?: string;
}

/** The fake driver, plus the state a test reads back. */
export interface FakeBrowserDriver extends BrowserDriver {
  readonly state: FakeBrowserState;
  element(selector: string): FakeElement | undefined;
}

// The driver is built in two halves so neither builder function outgrows the
// line budget. The split is arbitrary: together they are the whole interface.

/** Navigation and input methods. */
export type FakeCore = Pick<
  BrowserDriver,
  "launch" | "newContext" | "visit" | "click" | "fill" | "select" | "hover" | "press"
>;

/** Capture, wait and frame methods. */
export type FakeExtra = Pick<
  BrowserDriver,
  | "upload"
  | "download"
  | "screenshot"
  | "waitFor"
  | "waitForUrl"
  | "evaluate"
  | "frame"
  | "clearCookies"
>;
