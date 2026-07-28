import { describe, expect, it } from "vitest";
import { createFakeClient, okGraphqlResponse } from "./fake-client.js";
import { gqlClientConformance } from "./gql-client.suite.js";
import { createRealClient } from "./real-client.js";

gqlClientConformance({
  name: "fake",
  make: () => createFakeClient(),
  query: "{ me { id } }",
});

describe("fake GqlClient", () => {
  it("query returns the canned data", async () => {
    const client = createFakeClient({
      response: okGraphqlResponse({ data: { me: { id: "u1" } } }),
    });
    const response = await client.execute({ query: "{ me { id } }" });
    expect(response.data).toEqual({ me: { id: "u1" } });
    expect(response.errors).toBeUndefined();
  });

  it("responds per-query when keyed", async () => {
    const client = createFakeClient({
      responses: { "{ ping }": okGraphqlResponse({ data: { ping: "pong" } }) },
    });
    const response = await client.execute({ query: "{ ping }" });
    expect(response.data).toEqual({ ping: "pong" });
  });
});

describe("real GqlClient", () => {
  it("throws VN8090 until implemented", async () => {
    const client = createRealClient();
    await expect(client.execute({ query: "{ me { id } }" })).rejects.toMatchObject({
      code: "VN8090",
    });
  });
});
