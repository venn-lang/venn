import { describe, expect, it } from "vitest";
import { createShutdown } from "./create-shutdown.js";

describe("createShutdown", () => {
  it("closes newest first, because later things stand on earlier ones", async () => {
    const order: string[] = [];
    const shutdown = createShutdown();
    shutdown.add(() => void order.push("database"));
    shutdown.add(() => void order.push("server"));

    await shutdown.close();

    expect(order).toEqual(["server", "database"]);
  });

  it("closes once, however many times it is asked", async () => {
    let closed = 0;
    const shutdown = createShutdown();
    shutdown.add(() => {
      closed += 1;
    });

    await Promise.all([shutdown.close(), shutdown.close()]);
    await shutdown.close();

    expect(closed).toBe(1);
  });

  // Leaving is the goal: one closer that throws must not strand the others.
  it("keeps going when a closer fails", async () => {
    const order: string[] = [];
    const shutdown = createShutdown();
    shutdown.add(() => void order.push("database"));
    shutdown.add(() => {
      throw new Error("socket refused to die");
    });

    await expect(shutdown.close()).resolves.toBeUndefined();
    expect(order).toEqual(["database"]);
  });

  it("forgets what was unregistered — a file's server is not the run's", async () => {
    const order: string[] = [];
    const shutdown = createShutdown();
    const forget = shutdown.add(() => void order.push("first file"));
    shutdown.add(() => void order.push("second file"));

    forget();
    await shutdown.close();

    expect(order).toEqual(["second file"]);
  });
});
