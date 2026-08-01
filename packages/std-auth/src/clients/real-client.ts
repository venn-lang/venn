import { VennError } from "@venn-lang/contracts";
import { PLUGIN_CODES } from "@venn-lang/sdk";
import type { AuthClient } from "../port/index.js";

/**
 * The endpoint-backed `AuthClient`. Not implemented in this build.
 *
 * @throws VennError `VN8090` on every call, so a host that binds it fails loudly
 * instead of quietly handing a script a token that was never obtained.
 */
export function createRealAuthClient(): AuthClient {
  return {
    token: async () => {
      throw new VennError({
        code: PLUGIN_CODES.VN8090_NOT_BUILT,
        message: "OAuth2 real client not implemented in this build",
      });
    },
  };
}
