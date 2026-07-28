import { describe, expect, it } from "vitest";
import { createFakeClient } from "./fake-client.js";
import { grpcClientConformance } from "./grpc-client.suite.js";
import { createRealClient } from "./real-client.js";

grpcClientConformance({
  name: "fake",
  make: () => createFakeClient(),
  method: "Inventory/Check",
});

const reflection = [
  {
    name: "Check",
    requestType: "CheckRequest",
    responseType: "CheckResponse",
    clientStreaming: false,
    serverStreaming: false,
  },
];

describe("fake GrpcClient", () => {
  it("call returns the canned response keyed by method", async () => {
    const client = createFakeClient({
      responses: { "Inventory/Check": { inStock: true, quantity: 42 } },
    });
    const res = await client.call({ method: "Inventory/Check", request: { sku: "A-1" } });
    expect(res).toEqual({ inStock: true, quantity: 42 });
  });

  it("stream returns the canned messages", async () => {
    const client = createFakeClient({ streams: { "Prices/Watch": [{ price: 1 }, { price: 2 }] } });
    const msgs = await client.stream({ method: "Prices/Watch" });
    expect(msgs).toEqual([{ price: 1 }, { price: 2 }]);
  });

  it("reflect returns method metadata", async () => {
    const client = createFakeClient({ reflection: { Inventory: reflection } });
    const res = await client.reflect("Inventory");
    expect(res).toEqual(reflection);
  });
});

describe("real GrpcClient", () => {
  it("throws VN8090 until implemented", async () => {
    const client = createRealClient();
    await expect(client.call({ method: "Inventory/Check" })).rejects.toMatchObject({
      code: "VN8090",
    });
  });
});
