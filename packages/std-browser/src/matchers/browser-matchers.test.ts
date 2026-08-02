import { describe, expect, it } from "vitest";
import { createFakeBrowserDriver } from "../drivers/index.js";
import { text } from "./text.js";
import { visible } from "./visible.js";

const driver = createFakeBrowserDriver({
  elements: {
    "#welcome": { visible: true, text: "Welcome back" },
    "#hidden": { visible: false },
  },
});

describe("browser matchers", () => {
  it("visible reflects the element model", () => {
    expect(visible.test({ subject: driver.element("#welcome"), args: [], params: {} })).toBe(true);
    expect(visible.test({ subject: driver.element("#hidden"), args: [], params: {} })).toBe(false);
  });

  it("text passes on equality and substring", () => {
    const subject = driver.element("#welcome");
    expect(text.test({ subject, args: ["Welcome back"], params: {} })).toBe(true);
    expect(text.test({ subject, args: ["Welcome"], params: {} })).toBe(true);
    expect(text.test({ subject, args: ["Goodbye"], params: {} })).toBe(false);
  });

  /**
   * The message writes its argument with the renderer it was handed, so a
   * failure and a `print` of the same value agree. A stand-in here, marked, so
   * the test is about the deferring rather than about the text.
   */
  it("text writes what it wanted through the renderer it was handed", () => {
    const ctx = { log: () => {}, show: (value: unknown) => `<${value}>` };

    const said = text.message({ args: ["Welcome"], params: {} } as never, ctx as never);

    expect(said).toContain("<Welcome>");
  });
});
