import { describe, expect, it } from "vitest";
import type { GrpcClient } from "../port/index.js";

/** One GrpcClient implementation plus a method to call. */
export interface GrpcClientSpec {
  name: string;
  make(): GrpcClient;
  method: string;
}

/** The GrpcClient conformance suite: the shapes every implementation owes. */
export function grpcClientConformance(spec: GrpcClientSpec): void {
  describe(`GrpcClient · ${spec.name}`, () => {
    it("call resolves a message object", async () => {
      const message = await spec.make().call({ method: spec.method });
      expect(typeof message).toBe("object");
    });

    it("reflect resolves an array", async () => {
      const methods = await spec.make().reflect("Inventory");
      expect(Array.isArray(methods)).toBe(true);
    });
  });
}
