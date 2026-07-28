import type { ActionContext } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createFakeBrowserDriver, type FakeBrowserDriver } from "../drivers/index.js";
import { browserActions } from "./index.js";

function contextFor(driver: FakeBrowserDriver): ActionContext {
  return {
    port: () => driver,
    secrets: undefined,
    log: () => undefined,
    redact: () => undefined,
  } as unknown as ActionContext;
}

function run(
  driver: FakeBrowserDriver,
  name: string,
  args: readonly unknown[],
  params: unknown = {},
): unknown {
  const action = browserActions.find((candidate) => candidate.name === name);
  if (!action) throw new Error(`no action ${name}`);
  return action.run(contextFor(driver), { args, params });
}

describe("browser actions reach the driver", () => {
  it("registers the sixteen §13 verbs", () => {
    expect(browserActions).toHaveLength(16);
  });

  it("visit forwards the positional url", async () => {
    const driver = createFakeBrowserDriver();
    await run(driver, "visit", ["/home"], {});
    expect(driver.state.url).toBe("/home");
  });

  it("fill forwards selector and value", async () => {
    const driver = createFakeBrowserDriver({ elements: { "#q": {} } });
    await run(driver, "fill", ["#q", "hello"]);
    expect(driver.element("#q")?.value).toBe("hello");
  });

  it("frame enters the named iframe", async () => {
    const driver = createFakeBrowserDriver();
    await run(driver, "frame", ["stripe-card"]);
    expect(driver.state.frame).toBe("stripe-card");
  });
});
