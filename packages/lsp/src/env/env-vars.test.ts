import { describe, expect, it } from "vitest";
import type { EnvVar } from "./env.types.js";
import { envNames, envVars } from "./env-vars.js";
import { envHover } from "./render-env.js";

const SECTIONS = {
  local: { KEYCLOAK_URL: "https://local.test", ADMIN_PASSWORD: "hunter2" },
  ci: { KEYCLOAK_URL: "https://ci.test", CI_TOKEN: "abc" },
};

describe("env vars", () => {
  it("collects every declared name across environments, without duplicates", () => {
    expect(envNames(SECTIONS).sort()).toEqual([
      "ADMIN_PASSWORD",
      "CI_TOKEN",
      "KEYCLOAK_URL",
      "name",
    ]);
  });

  it("offers `env.name` too, set to whichever environment ran", () => {
    const selected = envVars(SECTIONS).find((variable) => variable.name === "name");

    expect(selected?.values).toEqual([
      { environment: "local", value: "local" },
      { environment: "ci", value: "ci" },
    ]);
  });

  it("keeps the value each environment sets", () => {
    const url = envVars(SECTIONS).find((variable) => variable.name === "KEYCLOAK_URL");

    expect(url?.values).toEqual([
      { environment: "local", value: "https://local.test" },
      { environment: "ci", value: "https://ci.test" },
    ]);
  });

  it("never carries the value of a name that reads like a credential", () => {
    const secrets = envVars(SECTIONS).filter((variable) => variable.secret);

    expect(secrets.map((variable) => variable.name).sort()).toEqual(["ADMIN_PASSWORD", "CI_TOKEN"]);
    for (const secret of secrets) {
      expect(secret.values.map((entry) => entry.value)).toEqual(["‹redacted›"]);
    }
    expect(JSON.stringify(envVars(SECTIONS))).not.toContain("hunter2");
  });

  it("has nothing to say when there is no manifest", () => {
    expect(envVars({})).toEqual([]);
  });
});

describe("env hover", () => {
  const docs = { KEYCLOAK_URL: "Base URL of the Keycloak server." };

  it("leads with the documentation written in venn.toml", () => {
    const url = envVars(SECTIONS, docs).find((variable) => variable.name === "KEYCLOAK_URL");
    const rendered = envHover(url as EnvVar);

    expect(rendered).toContain("Base URL of the Keycloak server.");
    expect(rendered.indexOf("Base URL")).toBeLessThan(rendered.indexOf("https://local.test"));
  });

  it("still shows the values, and says a secret is withheld", () => {
    const password = envVars(SECTIONS).find((variable) => variable.name === "ADMIN_PASSWORD");
    const rendered = envHover(password as EnvVar);

    expect(rendered).toContain("‹redacted›");
    expect(rendered).toContain("never printed");
    expect(rendered).not.toContain("hunter2");
  });
});
