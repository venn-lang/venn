import { describe, expect, it } from "vitest";
import type { CryptoEngine } from "./crypto-engine.types.js";

/**
 * The conformance suite every engine runs. It states the behaviour the actions
 * rely on, without demanding a particular algorithm's exact output.
 *
 * @param name What to call this engine in the report.
 * @param create Builds a fresh engine, once per assertion.
 */
export function cryptoEngineSuite(name: string, create: () => CryptoEngine): void {
  describe(name, () => {
    it("digests the same input to the same value", async () => {
      const engine = create();
      const once = await engine.digest({ algorithm: "sha256", data: "hello" });

      expect(await engine.digest({ algorithm: "sha256", data: "hello" })).toBe(once);
      expect(once).toMatch(/^[0-9a-f]+$/);
    });

    it("digests different inputs differently", async () => {
      const engine = create();

      expect(await engine.digest({ algorithm: "sha256", data: "a" })).not.toBe(
        await engine.digest({ algorithm: "sha256", data: "b" }),
      );
    });

    it("makes the hmac depend on the key", async () => {
      const engine = create();
      const args = { algorithm: "sha256", data: "payload" } as const;

      expect(await engine.hmac({ ...args, key: "k1" })).not.toBe(
        await engine.hmac({ ...args, key: "k2" }),
      );
    });

    // A TOTP counter is eight bytes, and byte 0x80 is not a character. An engine
    // that read the bytes as text would answer the same for both of these and
    // produce codes no authenticator agrees with.
    it("signs bytes as bytes and not as the text that spells them", async () => {
      const engine = create();
      const args = { algorithm: "sha1", key: "seed" } as const;
      const bytes = Uint8Array.from([0x80, 0x00, 0x01]);

      expect(await engine.hmac({ ...args, data: bytes })).not.toBe(
        await engine.hmac({ ...args, data: "\u0080\u0000\u0001" }),
      );
    });

    it("makes derivation depend on the salt", async () => {
      const engine = create();
      const args = { algorithm: "sha256", password: "pw", iterations: 10 } as const;

      expect(await engine.derive({ ...args, salt: "s1" })).not.toBe(
        await engine.derive({ ...args, salt: "s2" }),
      );
    });

    it("returns the requested number of random bytes as hex", () => {
      expect(create().randomBytes(16)).toMatch(/^[0-9a-f]{32}$/);
    });
  });
}
