import { describe, expect, it } from "vitest";
import type { WsClient } from "../port/index.js";

/** One WsClient implementation, preloaded so `expect` can resolve a known message. */
export interface WsClientSpec {
  name: string;
  make(): WsClient;
  /** The `type` the preloaded message carries, for the `expect` assertion. */
  expectType: string;
}

/** The WsClient conformance suite: the contract every implementation owes. */
export function wsClientConformance(spec: WsClientSpec): void {
  describe(`WsClient · ${spec.name}`, () => {
    it("connect resolves", async () => {
      await expect(spec.make().connect({ url: "wss://example.test" })).resolves.toBeUndefined();
    });
    it("send resolves", async () => {
      await expect(spec.make().send({ type: "ping" })).resolves.toBeUndefined();
    });
    it("expect resolves to a message with the requested type", async () => {
      const message = await spec.make().expect({ type: spec.expectType });
      expect(message.type).toBe(spec.expectType);
    });
    it("close resolves", async () => {
      await expect(spec.make().close()).resolves.toBeUndefined();
    });
  });
}
