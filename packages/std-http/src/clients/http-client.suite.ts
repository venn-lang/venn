import { describe, expect, it } from "vitest";
import type { HttpClient, HttpFailure } from "../port/index.js";

/** One HttpClient implementation, plus the three ways the suite drives it. */
export interface HttpClientSpec {
  name: string;
  make(): HttpClient;
  url: string;
  /** A client that really takes at least `ms` to answer {@link url}. */
  slow(ms: number): HttpClient;
  /** A client whose request to {@link url} fails the named way. */
  failing(failure: HttpFailure): HttpClient;
}

/** How long the slow client is made to take. Long enough to outlive rounding. */
const DELAY_MS = 60;

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

    it("time is milliseconds, never negative and never a guess", async () => {
      const response = await spec.make().request({ method: "GET", url: spec.url });
      expect(Number.isFinite(response.time)).toBe(true);
      expect(response.time).toBeGreaterThanOrEqual(0);
    });

    it("time is how long the request took", async () => {
      const response = await spec.slow(DELAY_MS).request({ method: "GET", url: spec.url });
      expect(response.time).toBeGreaterThanOrEqual(DELAY_MS - 10);
    });

    failureCases(spec);
  });
}

/** The three failures, told apart by code and each naming the request. */
function failureCases(spec: HttpClientSpec): void {
  const cases: readonly (readonly [HttpFailure, string])[] = [
    ["refused", "VN7022"],
    ["not-found", "VN7023"],
    ["timeout", "VN7024"],
  ];
  for (const [failure, code] of cases) {
    it(`a ${failure} request fails with ${code}, naming the request`, async () => {
      const error = await failureOf(spec.failing(failure), spec.url);
      expect(error.code).toBe(code);
      expect(error.message).toContain(spec.url);
      expect(error.message).not.toContain("fetch failed");
    });
  }
}

async function failureOf(
  client: HttpClient,
  url: string,
): Promise<{ code: string; message: string }> {
  try {
    await client.request({ method: "GET", url });
  } catch (error) {
    const raised = error as { code?: string; message?: string };
    return { code: raised.code ?? "", message: raised.message ?? "" };
  }
  throw new Error(`expected the request to ${url} to fail`);
}
