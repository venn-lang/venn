import { describe, expect, it } from "vitest";
import { tomlDocs } from "./toml-docs.js";

const CONTENT = `[env.local]
# Base URL of the Keycloak server.
KEYCLOAK_URL = "https://k.test"

# The realm the admin lives in.
#
# Usually \`master\`, not the realm being administered.
ADMIN_REALM = "master"

UNDOCUMENTED = "x"

# A note about the section, not about the key below it.

ORPHANED = "y"
`;

describe("tomlDocs", () => {
  it("attaches the comment written directly above a key", () => {
    expect(tomlDocs(CONTENT).KEYCLOAK_URL).toBe("Base URL of the Keycloak server.");
  });

  it("keeps a multi-line comment whole, blank comment lines included", () => {
    expect(tomlDocs(CONTENT).ADMIN_REALM).toBe(
      "The realm the admin lives in.\n\nUsually `master`, not the realm being administered.",
    );
  });

  it("leaves a key with no comment undocumented", () => {
    expect(tomlDocs(CONTENT).UNDOCUMENTED).toBeUndefined();
  });

  it("never attributes a comment that a blank line cut off", () => {
    expect(tomlDocs(CONTENT).ORPHANED).toBeUndefined();
  });

  it("does not mistake a section header for a key", () => {
    expect(Object.keys(tomlDocs(CONTENT))).toEqual(["KEYCLOAK_URL", "ADMIN_REALM"]);
  });
});
