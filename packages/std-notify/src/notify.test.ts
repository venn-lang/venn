import type { ActionContext, ActionDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { notifyActions } from "./actions/index.js";
import { createFakeNotifier } from "./clients/index.js";

function find(name: string): ActionDefinition {
  const action = notifyActions.find((candidate) => candidate.name === name);
  if (!action) throw new Error(`no action ${name}`);
  return action;
}

describe("notify actions", () => {
  it("slack records a notification with channel and mention", async () => {
    const fake = createFakeNotifier();
    const ctx = { port: () => fake } as unknown as ActionContext;
    await find("slack").run(ctx, { args: ["#qa"], params: { mention: "@vini" } });
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toMatchObject({ kind: "slack", channel: "#qa", mention: "@vini" });
  });

  it("webhook records the JSON payload", async () => {
    const fake = createFakeNotifier();
    const ctx = { port: () => fake } as unknown as ActionContext;
    await find("webhook").run(ctx, {
      args: ["https://hook.test/x"],
      params: { json: { ok: true } },
    });
    expect(fake.sent[0]).toMatchObject({
      kind: "webhook",
      channel: "https://hook.test/x",
      json: { ok: true },
    });
  });

  it("email records subject and body", async () => {
    const fake = createFakeNotifier();
    const ctx = { port: () => fake } as unknown as ActionContext;
    await find("email").run(ctx, { args: ["to@x"], params: { subject: "Hi", body: "Body" } });
    expect(fake.sent[0]).toMatchObject({
      kind: "email",
      channel: "to@x",
      subject: "Hi",
      body: "Body",
    });
  });

  it("dispatches each notification exactly once", async () => {
    const fake = createFakeNotifier();
    const ctx = { port: () => fake } as unknown as ActionContext;
    await find("slack").run(ctx, { args: ["#a"], params: {} });
    await find("email").run(ctx, { args: ["b@x"], params: {} });
    expect(fake.sent).toHaveLength(2);
  });
});
