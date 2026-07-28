import { VennError } from "@venn/contracts";
import { describe, expect, it } from "vitest";
import { createFakeBrowserDriver } from "./fake-driver.js";
import { createRealBrowserDriver } from "./real-driver.js";

describe("fake browser driver", () => {
  it("visit sets the url and records history", async () => {
    const driver = createFakeBrowserDriver();
    await driver.visit({ url: "/dashboard" });
    expect(driver.state.url).toBe("/dashboard");
    expect(driver.state.history).toContain("/dashboard");
  });

  it("click and fill record on the element model", async () => {
    const driver = createFakeBrowserDriver({ elements: { "#email": { visible: true } } });
    await driver.click("#submit");
    await driver.fill({ selector: "#email", value: "a@b.test" });
    expect(driver.state.clicks).toContain("#submit");
    expect(driver.state.fills).toEqual([{ selector: "#email", value: "a@b.test" }]);
    expect(driver.element("#email")?.value).toBe("a@b.test");
  });

  it("waitFor resolves and waitForUrl navigates", async () => {
    const driver = createFakeBrowserDriver();
    await expect(driver.waitFor({ text: "Welcome" })).resolves.toBeUndefined();
    await driver.waitForUrl("/next");
    expect(driver.state.url).toBe("/next");
  });

  it("evaluate returns the canned value", async () => {
    const driver = createFakeBrowserDriver();
    expect(await driver.evaluate({ script: "1 + 1" })).toEqual({ ok: true });
  });
});

describe("real browser driver", () => {
  it("throws VN8090 for every verb", () => {
    const driver = createRealBrowserDriver();
    let caught: unknown;
    try {
      driver.clearCookies();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VennError);
    expect((caught as VennError).code).toBe("VN8090");
  });
});
