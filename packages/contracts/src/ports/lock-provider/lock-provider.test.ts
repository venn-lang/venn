import { describe, expect, it } from "vitest";
import { createFakeLock } from "./fake-lock.js";
import { createInProcessLock } from "./in-process-lock.js";
import { lockProviderConformance } from "./lock-provider.suite.js";

lockProviderConformance({ name: "in-process", factory: () => createInProcessLock() });
lockProviderConformance({ name: "fake", factory: () => createFakeLock() });

describe("in-process lock serializes by name", () => {
  it("makes a second acquire wait for the first release", async () => {
    const lock = createInProcessLock();
    const order: number[] = [];
    const first = await lock.acquire("orders");
    const second = lock.acquire("orders").then((release) => {
      order.push(2);
      release();
    });
    order.push(1);
    first();
    await second;
    expect(order).toEqual([1, 2]);
  });
});
