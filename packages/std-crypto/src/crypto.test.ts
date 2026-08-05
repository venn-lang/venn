import {
  type ActionContext,
  type ActionDefinition,
  createWebCryptoEngine,
  fromBytes,
  toBase64Url,
  toBytes,
} from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { cryptoActions } from "./actions/index.js";
import { decodeJwt } from "./jwt/index.js";

const engine = createWebCryptoEngine();
const ctx = {
  port: () => engine,
  config: {},
  log: () => {},
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

  // 200 KB used to raise `RangeError: Maximum call stack size exceeded`, out of
  // `String.fromCharCode(...bytes)`, and the reporter turned every RangeError
  // mentioning the call stack into VN8003 "something calls itself and never
  // stops". No Venn program here recurses at all.
  it("encodes a 200 KB string without running out of stack", () => {
    const big = "a".repeat(200_000);
    const encoded = String(call("base64.encode", big));

    expect(encoded).toHaveLength(266_668);
    expect(call("base64.decode", encoded)).toBe(big);
  });

  it("says which code an unreadable base64 string failed under", () => {
    expect(() => call("base64.decode", "not base64!")).toThrow(
      expect.objectContaining({ code: "VN7003" }),
    );
  });

  /**
   * The two DOMExceptions WebCrypto can still raise, each now carrying a code.
   *
   * An empty HMAC key is a `DataError` and more than 65536 random bytes is a
   * `QuotaExceededError`. A `DOMException`'s `code` is the number `0`, so
   * `problemOf` reported both uncatalogued, with the note `It came with the code
   * "0", which is not one of ours` and nothing to search for. The span is the
   * runtime's to add, and it adds one for any throw.
   */
  it("gives a WebCrypto refusal a code of ours", async () => {
    await expect(call("hmac", "data", { key: "" })).rejects.toMatchObject({ code: "VN7005" });
    expect(() => call("randomBytes", undefined, { size: 100_000 })).toThrow(
      expect.objectContaining({ code: "VN7005" }),
    );
  });

  // Every one of the three verifies with the digest its own header names. The
  // signer used to write `alg` into the header and sign with SHA-256 whatever it
  // said, so an HS512 token verified as false against an untampered payload.
  it("verifies a token signed under each algorithm it offers", async () => {
    for (const algorithm of ["HS256", "HS384", "HS512"]) {
      const token = await call("jwt.sign", undefined, {
        payload: { sub: "a" },
        secret: "k",
        algorithm,
      });

      expect(decodeJwt(String(token)).header.alg).toBe(algorithm);
      expect(await call("jwt.verify", token, { secret: "k" })).toBe(true);
    }
  });
});
