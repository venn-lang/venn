import type { ActionContext, ActionDefinition } from "@venn/sdk";
import { describe, expect, it } from "vitest";
import { cryptoActions } from "./actions/index.js";
import { fromBytes, toBase64Url, toBytes } from "./bytes/index.js";
import { createWebCryptoEngine } from "./engines/index.js";
import { decodeJwt } from "./jwt/index.js";

const engine = createWebCryptoEngine();
const ctx = {
  port: () => engine,
  config: {},
  log: () => {},
  redact: () => {},
} as unknown as ActionContext;

function action(name: string): ActionDefinition {
  const found = cryptoActions.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no action ${name}`);
  return found;
}

function call(name: string, arg?: unknown, params?: unknown): unknown {
  const schema = action(name).params;
  return action(name).run(ctx, {
    args: arg === undefined ? [] : [arg],
    params: schema ? schema.parse(params) : params,
  });
}

describe("crypto", () => {
  it("round-trips base64url, including bytes base64 would pad", () => {
    expect(call("base64url.decode", call("base64url.encode", "olá mundo"))).toBe("olá mundo");
  });

  it("hashes deterministically and differently per input", async () => {
    expect(await call("hash", "abc")).toBe(await call("hash", "abc"));
    expect(await call("hash", "abc")).not.toBe(await call("hash", "abd"));
  });

  it("mints a uuid v4", () => {
    expect(call("uuid")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("signs a token another party can verify", async () => {
    const token = await call("jwt.sign", undefined, {
      payload: { sub: "alice" },
      secret: "s3cret",
    });

    expect(await call("jwt.verify", token, { secret: "s3cret" })).toBe(true);
    expect(await call("jwt.verify", token, { secret: "wrong" })).toBe(false);
  });

  it("decodes a token without needing the secret", async () => {
    const token = await call("jwt.sign", undefined, {
      payload: { sub: "alice", roles: ["admin"] },
      secret: "s3cret",
    });

    const decoded = decodeJwt(String(token));
    expect(decoded.header.alg).toBe("HS256");
    expect(decoded.payload.sub).toBe("alice");
    expect(decoded.payload.roles).toEqual(["admin"]);
  });

  it("refuses a token that is not a token", () => {
    expect(() => decodeJwt("nope")).toThrow(/Not a JWT/);
  });

  it("rejects a token whose payload was tampered with", async () => {
    const token = String(await call("jwt.sign", undefined, { payload: { sub: "a" }, secret: "k" }));
    const [header, , signature] = token.split(".");
    const forged = `${header}.${toBase64Url(toBytes(JSON.stringify({ sub: "admin" })))}.${signature}`;

    expect(await call("jwt.verify", forged, { secret: "k" })).toBe(false);
  });

  it("verifies a password against its own hash, and only its own", async () => {
    const hash = String(await call("password.hash", "correct horse", { iterations: 1000 }));

    expect(hash.startsWith("pbkdf2$sha256$1000$")).toBe(true);
    expect(await call("password.verify", "correct horse", { hash })).toBe(true);
    expect(await call("password.verify", "wrong horse", { hash })).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    const first = await call("password.hash", "pw", { iterations: 1000 });
    const second = await call("password.hash", "pw", { iterations: 1000 });

    expect(first).not.toBe(second);
  });

  it("encodes and decodes base64 text", () => {
    expect(fromBytes(toBytes("x"))).toBe("x");
    expect(call("base64.decode", call("base64.encode", "hello"))).toBe("hello");
  });
});
