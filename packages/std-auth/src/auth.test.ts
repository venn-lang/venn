import {
  type ActionContext,
  type ActionDefinition,
  CryptoEnginePort,
  createFakeCryptoEngine,
} from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { authActions } from "./actions/index.js";
import { createFakeAuthClient } from "./clients/index.js";

const engine = createFakeCryptoEngine();

// Two ports, answered by id. `auth.hmac`, `auth.totp` and `auth.jwt` reached the
// global `crypto.subtle` before this, so a host binding the deterministic engine
// could not change what they answered and this file could not have bound one.
const ctx = {
  port: (port: { id: string }) =>
    port.id === CryptoEnginePort.id ? engine : createFakeAuthClient(),
} as unknown as ActionContext;

function find(name: string): ActionDefinition {
  const action = authActions.find((candidate) => candidate.name === name);
  if (!action) throw new Error(`no action ${name}`);
  return action;
}

describe("auth actions", () => {
  it("bearer builds an Authorization header", async () => {
    const out = await find("bearer").run(ctx, { args: ["abc123"], params: {} });
    expect(out).toEqual({ Authorization: "Bearer abc123" });
  });

  // ASCII, which is the case that always worked, kept beside the one that did not.
  it("basic base64-encodes user:pass", async () => {
    const out = await find("basic").run(ctx, { args: ["alice", "s3cret"], params: {} });
    expect(out).toEqual({ Authorization: "Basic YWxpY2U6czNjcmV0" });
  });

  /**
   * RFC 7617 §2 says UTF-8, and the exact header is the assertion.
   *
   * `btoa` sent latin-1 for `señha`, `dXNlcjpzZfFoYQ==`, which is a different
   * password: the server answers 401 and nothing in Venn says why. A round trip
   * through the same wrong encoder agrees with itself, so it has to be spelled out.
   */
  it("basic sends the UTF-8 bytes of a non-ASCII credential", async () => {
    const out = await find("basic").run(ctx, { args: ["user", "señha"], params: {} });
    expect(out).toEqual({ Authorization: "Basic dXNlcjpzZcOxaGE=" });
  });

  // Above U+00FF `btoa` threw a DOMException with no code and no line at all.
  it("basic encodes a credential outside latin-1 at all", async () => {
    const out = await find("basic").run(ctx, { args: ["user", "パス"], params: {} });
    expect(out).toEqual({ Authorization: "Basic dXNlcjrjg5Hjgrk=" });
  });

  it("apikey uses the given header name", async () => {
    const out = await find("apikey").run(ctx, { args: ["KEY"], params: { header: "X-Token" } });
    expect(out).toEqual({ "X-Token": "KEY" });
  });

  it("apikey defaults the header to X-API-Key", async () => {
    const out = await find("apikey").run(ctx, { args: ["KEY"], params: {} });
    expect(out).toEqual({ "X-API-Key": "KEY" });
  });

  it("hmac is deterministic hex", async () => {
    const a = await find("hmac").run(ctx, { args: ["secret", "payload"], params: {} });
    const b = await find("hmac").run(ctx, { args: ["secret", "payload"], params: {} });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("totp yields a stable 6-digit code for a fixed time", async () => {
    const code = await find("totp").run(ctx, { args: ["seed"], params: { at: 0 } });
    const again = await find("totp").run(ctx, { args: ["seed"], params: { at: 0 } });
    expect(code).toMatch(/^\d{6}$/);
    expect(code).toBe(again);
  });

  it("jwt has three dot-separated segments", async () => {
    const token = await find("jwt").run(ctx, {
      args: [],
      params: { payload: { sub: "42" }, secret: "k" },
    });
    expect(String(token).split(".")).toHaveLength(3);
  });

  it("oauth2 returns a token from the port", async () => {
    const token = await find("oauth2").run(ctx, { args: ["svc"], params: {} });
    expect(token).toMatchObject({
      access_token: expect.any(String),
      expires_in: expect.any(Number),
    });
  });
});
