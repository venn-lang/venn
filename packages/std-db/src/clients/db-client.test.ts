import { VennError } from "@venn/contracts";
import { describe, expect, it } from "vitest";
import { dbClientConformance } from "./db-client.suite.js";
import { createFakeDbClient } from "./fake-client.js";
import { createRealDbClient } from "./real-client.js";

dbClientConformance({ name: "fake", make: (tables) => createFakeDbClient({ tables }) });

describe("fake db tables", () => {
  it("seed loads rows and query returns them", async () => {
    const db = createFakeDbClient();
    expect(await db.seed({ users: [{ id: 1 }, { id: 2 }] })).toBe(2);
    expect(await db.query({ sql: "SELECT * FROM users" })).toHaveLength(2);
  });

  it("restore reverts an INSERT without aliasing the snapshot", async () => {
    const db = createFakeDbClient({ tables: { users: [{ id: 1 }] } });
    const snapshot = await db.snapshot();
    await db.exec({ sql: "INSERT INTO users", rows: [{ id: 2 }] });
    await db.restore(snapshot);
    expect(await db.query({ sql: "SELECT * FROM users" })).toEqual([{ id: 1 }]);
  });
});

describe("real db client", () => {
  it("methods fail with VN8090 until implemented", () => {
    expect(codeOf(() => createRealDbClient().connect("postgres://x"))).toBe("VN8090");
  });
});

function codeOf(fn: () => unknown): string {
  try {
    fn();
    return "no-throw";
  } catch (error) {
    return error instanceof VennError ? error.code : "not-venn-error";
  }
}
