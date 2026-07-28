import { type ActionDefinition, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { arg0, browserDriver } from "./support.js";

const launchParams = z.object({
  engine: z.string().optional(),
  headless: z.boolean().optional(),
});

const contextParams = z.object({
  locale: z.string().optional(),
  viewport: z.object({ width: z.number(), height: z.number() }).optional(),
});

const visitParams = z.object({ headers: z.record(z.string(), z.string()).optional() });

/**
 * `browser.launch { engine: "chromium", headless: true }`.
 *
 * Starts a browser engine. Everything else in the namespace needs one running.
 *
 * @returns a `browser.Browser` handle.
 */
export const launch: ActionDefinition = defineAction({
  name: "launch",
  doc: "Launch a browser engine.",
  params: launchParams.optional(),
  result: t.ref("browser.Browser"),
  run: (ctx, input) => browserDriver(ctx).launch(input.params ?? {}),
});

/**
 * `browser.visit "/checkout" { headers: { "X-Debug": "1" } }`.
 *
 * Navigates the page and waits for it to load. A relative path joins the base
 * URL; an absolute one is used as given.
 */
export const visit: ActionDefinition = defineAction({
  name: "visit",
  doc: "Navigate the page to a URL.",
  params: visitParams.optional(),
  args: [arg("url", t.string, "Where to go. Relative paths join the base URL.")],
  result: t.void,
  run: (ctx, input) =>
    browserDriver(ctx).visit({ url: arg0(input), headers: input.params?.headers }),
});

/**
 * `browser.waitForUrl "/orders/*"`.
 *
 * Blocks until the page lands on a matching URL. Use it after an action that
 * navigates on its own, such as a form submit or a redirect.
 */
export const waitForUrl: ActionDefinition = defineAction({
  name: "waitForUrl",
  doc: "Wait until the page URL matches.",
  args: [arg("url", t.string, "The URL to wait for. A pattern is allowed.")],
  result: t.void,
  run: (ctx, input) => browserDriver(ctx).waitForUrl(arg0(input)),
});

/**
 * `browser.newContext { locale: "pt-BR", viewport: { width: 1280, height: 800 } }`.
 *
 * Opens an isolated context: its own cookies, storage and viewport. Two
 * contexts in one browser cannot see each other's session.
 *
 * @returns a `browser.Page` handle.
 */
export const newContext: ActionDefinition = defineAction({
  name: "newContext",
  doc: "Open an isolated browser context (a Page).",
  params: contextParams.optional(),
  result: t.ref("browser.Page"),
  run: (ctx, input) => browserDriver(ctx).newContext(input.params ?? {}),
});

/**
 * `browser.clearCookies`.
 *
 * Drops every cookie in the current context, logging the session out. Storage
 * is left alone.
 */
export const clearCookies: ActionDefinition = defineAction({
  name: "clearCookies",
  doc: "Clear all cookies in the current context.",
  result: t.void,
  run: (ctx) => browserDriver(ctx).clearCookies(),
});
