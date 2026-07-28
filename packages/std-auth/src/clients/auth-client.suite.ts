import { describe, expect, it } from "vitest";
import type { AuthClient } from "../port/index.js";

/** One AuthClient implementation plus a principal to request a token for. */
export interface AuthClientSpec {
  name: string;
  make(): AuthClient;
  principal: string;
}

/** The AuthClient TCK: the shape every returned token must satisfy. */
export function authClientConformance(spec: AuthClientSpec): void {
  describe(`AuthClient · ${spec.name}`, () => {
    it("token resolves an access token with numeric expiry", async () => {
      const token = await spec.make().token({ principal: spec.principal });
      expect(typeof token.access_token).toBe("string");
      expect(typeof token.token_type).toBe("string");
      expect(typeof token.expires_in).toBe("number");
    });
  });
}
