import { expect, it, vi } from "vitest";
import type { HttpClient, HttpFailure } from "../port/index.js";
import { createFakeClient } from "./fake-client.js";
import { createFetchClient } from "./fetch-client.js";
import { httpClientConformance } from "./http-client.suite.js";
import { fetchRejection } from "./platform-failures.suite.js";

const URL_UNDER_TEST = "https://example.test/";

httpClientConformance({
  name: "fake",
  make: () => createFakeClient(),
  url: URL_UNDER_TEST,
  slow: (ms) => createFakeClient({ latency: ms }),
  failing: (failure) => createFakeClient({ failures: { [URL_UNDER_TEST]: failure } }),
});

// Stub the global fetch so the real client's mapping runs the same TCK offline.
// Every factory stubs afresh, so no case inherits the reply another one wanted.
function stubbedFetchClient(impl: typeof fetch): HttpClient {
  vi.stubGlobal("fetch", impl);
  return createFetchClient();
}

const okReply = (): Response =>
  new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function slowFetch(ms: number): typeof fetch {
  return (async () => {
    await pause(ms);
    return okReply();
  }) as typeof fetch;
}

function failingFetch(failure: HttpFailure): typeof fetch {
  return (async () => {
    throw fetchRejection(failure);
  }) as typeof fetch;
}

httpClientConformance({
  name: "fetch (stubbed)",
  make: () => stubbedFetchClient((async () => okReply()) as typeof fetch),
  url: URL_UNDER_TEST,
  slow: (ms) => stubbedFetchClient(slowFetch(ms)),
  failing: (failure) => stubbedFetchClient(failingFetch(failure)),
});

it("fetch client parses the JSON body", async () => {
  const client = stubbedFetchClient((async () => okReply()) as typeof fetch);
  const response = await client.request({ method: "GET", url: URL_UNDER_TEST });
  expect(response.json).toEqual({ ok: true });
  expect(response.status).toBe(200);
});
