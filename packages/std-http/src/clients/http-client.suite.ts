import { describe, expect, it } from "vitest";
import type { HttpClient } from "../port/index.js";

/** One HttpClient implementation plus a URL to request. */
export interface HttpClientSpec {
  name: string;
  make(): HttpClient;
  url: string;
}

/** The HttpClient conformance suite: the response shape every implementation owes. */
export function httpClientConformance(spec: HttpClientSpec): void {
  describe(`HttpClient · ${spec.name}`, () => {
    it("request resolves a response with a numeric status", async () => {
      const client = spec.make();
      const response = await client.request({ method: "GET", url: spec.url });
      expect(typeof response.status).toBe("number");
      expect(typeof response.ok).toBe("boolean");
      expect(typeof response.headers).toBe("object");
    });
  });
}
