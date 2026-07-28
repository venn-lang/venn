import { describe, expect, it } from "vitest";
import { authClientConformance } from "./auth-client.suite.js";
import { createFakeAuthClient } from "./fake-client.js";
import { createRealAuthClient } from "./real-client.js";

authClientConformance({
  name: "fake",
  make: () => createFakeAuthClient(),
  principal: "svc-account",
});

describe("AuthClient · real (stub)", () => {
  it("real client throws VN8090 until implemented", async () => {
    const client = createRealAuthClient();
    await expect(client.token({ principal: "svc-account" })).rejects.toMatchObject({
      code: "VN8090",
    });
  });
});
