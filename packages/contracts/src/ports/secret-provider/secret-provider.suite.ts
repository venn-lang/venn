import { describe, expect, it } from "vitest";
import type { ConformanceSpec } from "../../conformance/index.js";
import type { SecretProvider } from "./secret-provider.types.js";

/** A secret the implementation under test is known to hold. */
export type KnownSecret = { name: string; raw: string };

/**
 * The {@link SecretProvider} TCK. The redaction law is the load-bearing one:
 * an implementation that leaks through `JSON.stringify` fails here.
 */
export function secretProviderConformance(
  spec: ConformanceSpec<SecretProvider> & { known: KnownSecret },
): void {
  describe(`SecretProvider · ${spec.name}`, () => {
    it("reveals the known secret", async () => {
      const secrets = await spec.factory();
      expect(secrets.get(spec.known.name)?.reveal()).toBe(spec.known.raw);
    });

    it("never leaks the raw value through serialization", async () => {
      const secrets = await spec.factory();
      const secret = secrets.get(spec.known.name);
      expect(JSON.stringify(secret)).not.toContain(spec.known.raw);
      expect(String(secret)).not.toContain(spec.known.raw);
    });
  });
}
