import { VennError } from "@venn-lang/contracts";
import { expect, it } from "vitest";
import { createFakeWsClient } from "./fake-client.js";
import { createRealWsClient } from "./real-client.js";
import { wsClientConformance } from "./ws-client.suite.js";

wsClientConformance({
  name: "fake",
  make: () => createFakeWsClient({ incoming: [{ type: "ack", data: { ok: true } }] }),
  expectType: "ack",
});

it("connect then send records the sent messages", async () => {
  const client = createFakeWsClient();
  await client.connect({ url: "wss://example.test", auth: "token" });
  await client.send({ type: "ping", data: 1 });
  expect(client.sent).toEqual([{ type: "ping", data: 1 }]);
});

it("expect returns the matching message, not merely the first", async () => {
  const client = createFakeWsClient({ incoming: [{ type: "a" }, { type: "b" }] });
  expect((await client.expect({ type: "b" })).type).toBe("b");
});

it("expect falls back to the first message when none match", async () => {
  const client = createFakeWsClient({ incoming: [{ type: "a" }, { type: "b" }] });
  expect((await client.expect({ type: "zzz" })).type).toBe("a");
});

it("expect matches on a where field", async () => {
  const client = createFakeWsClient({
    incoming: [
      { type: "x", data: { id: 2 } },
      { type: "x", data: { id: 9 } },
    ],
  });
  const message = await client.expect({ where: { data: { id: 9 } } });
  expect((message.data as { id: number }).id).toBe(9);
});

it("real client throws VN8090", () => {
  let error: unknown;
  try {
    createRealWsClient().close();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(VennError);
  expect((error as VennError).code).toBe("VN8090");
});
