import { describe, expect, it } from "vitest";
import type { DbClient, SeedData } from "../port/index.js";

/** The fixture tables every DbClient implementation is checked against. */
const FIXTURE: SeedData = {
  users: [
    { id: 1, name: "Ada" },
    { id: 2, name: "Grace" },
  ],
};

/** The DbClient TCK: the behaviour every implementation must satisfy. */
export function dbClientConformance(spec: {
  name: string;
  make: (tables: SeedData) => DbClient;
}): void {
  describe(`DbClient · ${spec.name}`, () => {
    it("query returns the seeded rows", async () => {
      const rows = await spec.make(FIXTURE).query({ sql: "SELECT * FROM users" });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ id: 1, name: "Ada" });
    });

    it("query filters by a simple where clause", async () => {
      const rows = await spec.make(FIXTURE).query({ sql: "SELECT * FROM users", where: { id: 2 } });
      expect(rows).toEqual([{ id: 2, name: "Grace" }]);
    });

    it("exec TRUNCATE clears the table and reports the affected count", async () => {
      const db = spec.make(FIXTURE);
      expect(await db.exec({ sql: "TRUNCATE users" })).toBe(2);
      expect(await db.query({ sql: "SELECT * FROM users" })).toEqual([]);
    });

    it("snapshot/restore round-trips the in-memory state", async () => {
      const db = spec.make(FIXTURE);
      const snapshot = await db.snapshot();
      await db.exec({ sql: "TRUNCATE users" });
      await db.restore(snapshot);
      expect(await db.query({ sql: "SELECT * FROM users" })).toHaveLength(2);
    });
  });
}
