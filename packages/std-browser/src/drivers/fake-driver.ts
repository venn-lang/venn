import type { FillArgs } from "../port/index.js";
import type {
  FakeBrowserDriver,
  FakeBrowserState,
  FakeCore,
  FakeDriverOptions,
  FakeElement,
  FakeExtra,
} from "./fake-driver.types.js";

/**
 * Discards an already-evaluated side effect and resolves void. Lets a method
 * body stay a single expression whatever the mutation returned.
 */
function after(_effect: unknown): Promise<void> {
  return Promise.resolve();
}

function navigate(state: FakeBrowserState, url: string): void {
  state.url = url;
  state.history.push(url);
}

function recordFill(state: FakeBrowserState, args: FillArgs): void {
  state.fills.push({ selector: args.selector, value: args.value });
  const element = state.elements.get(args.selector);
  if (element) element.value = args.value;
}

function enterFrame(state: FakeBrowserState, name: string): void {
  state.frame = name;
}

function bumpCookies(state: FakeBrowserState): void {
  state.cookiesCleared += 1;
}

function toElements(input: Record<string, Partial<FakeElement>>): Map<string, FakeElement> {
  const elements = new Map<string, FakeElement>();
  for (const [selector, partial] of Object.entries(input)) {
    elements.set(selector, { visible: true, text: "", value: "", ...partial });
  }
  return elements;
}

function initState(options: FakeDriverOptions): FakeBrowserState {
  const url = options.url ?? "about:blank";
  return {
    url,
    history: options.url ? [url] : [],
    clicks: [],
    fills: [],
    frame: undefined,
    cookiesCleared: 0,
    evalResult: { ok: true },
    elements: toElements(options.elements ?? {}),
  };
}

function coreMethods(state: FakeBrowserState): FakeCore {
  return {
    launch: (opts) => Promise.resolve({ id: "browser-1", engine: opts.engine ?? "chromium" }),
    newContext: () => Promise.resolve({ id: "page-1", url: state.url }),
    visit: (args) => after(navigate(state, args.url)),
    click: (selector) => after(state.clicks.push(selector)),
    fill: (args) => after(recordFill(state, args)),
    select: (args) => after(recordFill(state, args)),
    hover: () => Promise.resolve(),
    press: () => Promise.resolve(),
  };
}

function extraMethods(state: FakeBrowserState): FakeExtra {
  return {
    upload: () => Promise.resolve(),
    download: () => Promise.resolve({ path: "/artifacts/download.bin", bytes: 0 }),
    screenshot: (name) => Promise.resolve({ name, path: `/artifacts/${name}.png` }),
    waitFor: () => Promise.resolve(),
    waitForUrl: (url) => after(navigate(state, url)),
    evaluate: () => Promise.resolve(state.evalResult),
    frame: (args) => after(enterFrame(state, args.name)),
    clearCookies: () => after(bumpCookies(state)),
  };
}

/**
 * The offline `BrowserDriver`. Every method resolves at once against an
 * in-memory page, so a test never waits on a real browser.
 *
 * @param options elements to preload and the URL to start at.
 * @returns a fresh driver whose `state` records what the flow did.
 */
export function createFakeBrowserDriver(options: FakeDriverOptions = {}): FakeBrowserDriver {
  const state = initState(options);
  return {
    ...coreMethods(state),
    ...extraMethods(state),
    state,
    element: (selector) => state.elements.get(selector),
  };
}
