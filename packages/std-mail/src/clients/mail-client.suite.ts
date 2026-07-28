import { describe, expect, it } from "vitest";
import type { MailClient } from "../port/index.js";
import type { Email } from "../types/index.js";

/** The one email every implementation is checked against. */
const FIXTURE: Email = {
  to: "ada@example.test",
  subject: "Your verification code is 246813",
  body: "Welcome to Venn.",
  attachments: [{ filename: "welcome.pdf", contentType: "application/pdf", size: 4 }],
};

/**
 * The `MailClient` conformance suite. Every implementation runs it: subject
 * matching is a substring test, `read` and `attachments` answer about whatever
 * `waitFor` last matched, and a cleared inbox matches nothing.
 */
export function mailClientConformance(spec: {
  name: string;
  make: (inbox: Email[]) => MailClient;
}): void {
  describe(`MailClient · ${spec.name}`, () => {
    it("waitFor matches the subject as a substring", async () => {
      const email = await spec.make([FIXTURE]).waitFor({ subject: "verification code" });
      expect(email.subject).toBe(FIXTURE.subject);
    });

    it("read returns the current email body", async () => {
      const client = spec.make([FIXTURE]);
      await client.waitFor({ to: FIXTURE.to });
      expect(await client.read()).toBe(FIXTURE.body);
    });

    it("attachments returns the current email attachments", async () => {
      const client = spec.make([FIXTURE]);
      await client.waitFor({ subject: "verification" });
      expect(await client.attachments()).toEqual(FIXTURE.attachments);
    });

    it("clear empties the inbox", async () => {
      const client = spec.make([FIXTURE]);
      await client.clear();
      await expect(client.waitFor({ subject: "verification" })).rejects.toMatchObject({
        code: "VN8091",
      });
    });
  });
}
