import { expect, it, vi } from "vitest";
import { createFakeClient } from "./fake-client.js";
import { createFetchClient } from "./fetch-client.js";
import { httpClientConformance } from "./http-client.suite.js";

httpClientConformance({
  name: "fake",
  make: () => createFakeClient(),
  url: "https://example.test/",
});

// Stub the global fetch so the real client's mapping runs the same TCK offline.
vi.stubGlobal(
  "fetch",
  async () =>
    new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } }),
);

httpClientConformance({
  name: "fetch (stubbed)",
  make: () => createFetchClient(),
  url: "https://example.test/",
});

it("fetch client parses the JSON body", async () => {
  const client = createFetchClient();
  const response = await client.request({ method: "GET", url: "https://example.test/" });
  expect(response.json).toEqual({ ok: true });
  expect(response.status).toBe(200);
});
