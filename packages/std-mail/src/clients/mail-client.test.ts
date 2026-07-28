import { VennError } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import { createFakeMailClient } from "./fake-client.js";
import { mailClientConformance } from "./mail-client.suite.js";
import { createRealMailClient } from "./real-client.js";

mailClientConformance({ name: "fake", make: (inbox) => createFakeMailClient({ inbox }) });

describe("fake mail inbox", () => {
  it("finds a preloaded email by subject substring and lists its attachments", async () => {
    const client = createFakeMailClient({
      inbox: [
        {
          to: "ada@example.test",
          subject: "Password reset code 9182",
          body: "hello",
          attachments: [{ filename: "a.pdf", contentType: "application/pdf", size: 1 }],
        },
      ],
    });
    const email = await client.waitFor({ subject: "reset code" });
    expect(email.to).toBe("ada@example.test");
    expect(await client.attachments()).toHaveLength(1);
  });
});

describe("real mail client", () => {
  it("methods fail with VN8090 until implemented", () => {
    expect(codeOf(() => createRealMailClient().read())).toBe("VN8090");
  });
});

function codeOf(fn: () => unknown): string {
  try {
    fn();
    return "no-throw";
  } catch (error) {
    return error instanceof VennError ? error.code : "not-venn-error";
  }
}
