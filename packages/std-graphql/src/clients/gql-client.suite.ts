import { describe, expect, it } from "vitest";
import type { GqlClient } from "../port/index.js";

/** One GqlClient implementation plus a document to execute. */
export interface GqlClientSpec {
  name: string;
  make(): GqlClient;
  query: string;
}

/** The GqlClient conformance suite: the envelope every implementation owes. */
export function gqlClientConformance(spec: GqlClientSpec): void {
  describe(`GqlClient · ${spec.name}`, () => {
    it("execute resolves a response envelope", async () => {
      const client = spec.make();
      const response = await client.execute({ query: spec.query });
      expect(typeof response).toBe("object");
      expect(response).not.toBeNull();
    });
  });
}
