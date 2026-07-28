import type { Port } from "@venn/contracts";
import type { AuthClient } from "./auth-client.types.js";

/**
 * The port `auth.oauth2` obtains its tokens through.
 *
 * Bound by the host to `createFakeAuthClient` or `createRealAuthClient`.
 * Requires the `net` capability, so a host without it is refused at load time
 * rather than failing mid-run.
 */
export const AuthClientPort: Port<AuthClient> = {
  id: "venn.port.auth-client",
  version: 1,
  requires: ["net"],
  methods: ["token"],
};
