// biome-ignore-all lint/suspicious/noTemplateCurlyInString: ${name} is a placeholder in a dotenv path, not a JavaScript template.
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultManifest, type Manifest } from "@venn/contracts";
import { describe, expect, it } from "vitest";
import { loadEnv } from "./load-env.js";

const manifest = (env: Record<string, Record<string, string>>, files?: string[]): Manifest =>
  defaultManifest({ name: "t", version: "1", env, envFiles: files ?? [] });

async function dir(files: Record<string, string>): Promise<string> {
  const at = await mkdtemp(join(tmpdir(), "venn-env-"));
  for (const [name, body] of Object.entries(files)) await writeFile(join(at, name), body);
  return at;
}

describe("where a variable comes from", () => {
  it("reads what venn.toml declares", async () => {
    const env = await loadEnv({
      manifest: manifest({ local: { BASE: "from-toml" } }),
      name: "local",
      dir: await dir({}),
      processEnv: {},
    });

    expect(env.BASE).toBe("from-toml");
    expect(env.name).toBe("local");
  });

  // Lowest to highest: the committed default, then the shared file, then the
  // one for this environment, then the one this machine keeps to itself.
  it("lets each dotenv file override the one before it", async () => {
    const at = await dir({
      ".env": "BASE=from-env",
      ".env.staging": "BASE=from-env-staging",
      ".env.local": "BASE=from-env-local",
    });

    const env = await loadEnv({
      manifest: manifest({ staging: { BASE: "from-toml" } }),
      name: "staging",
      dir: at,
      processEnv: {},
    });

    expect(env.BASE).toBe("from-env-local");
  });

  // How CI passes a token in. A value given on the command line must not lose
  // to a file someone committed.
  it("lets the real environment win over every file", async () => {
    const at = await dir({ ".env": "TOKEN=from-file" });

    const env = await loadEnv({
      manifest: manifest({ local: { TOKEN: "from-toml" } }),
      name: "local",
      dir: at,
      processEnv: { TOKEN: "from-the-shell" },
    });

    expect(env.TOKEN).toBe("from-the-shell");
  });

  /**
   * A shell holds hundreds of entries. Letting them all become `env.*` would
   * put `PATH` in the editor's completion and let a typo read the machine.
   * `secrets.*` is what reads the environment without being declared.
   */
  it("ignores what the environment has but nobody declared", async () => {
    const env = await loadEnv({
      manifest: manifest({ local: { BASE: "declared" } }),
      name: "local",
      dir: await dir({}),
      processEnv: { PATH: "/usr/bin", SOMETHING_ELSE: "x" },
    });

    expect(env.PATH).toBeUndefined();
    expect(env.SOMETHING_ELSE).toBeUndefined();
    expect(env.BASE).toBe("declared");
  });

  it("takes the files the manifest names, with the environment filled in", async () => {
    const at = await dir({ ".env.staging.local": "BASE=named-file", ".env": "BASE=ignored" });

    const env = await loadEnv({
      manifest: manifest({}, [".env.${name}.local"]),
      name: "staging",
      dir: at,
      processEnv: {},
    });

    expect(env.BASE).toBe("named-file");
  });

  it("declares a name in a dotenv file, so the environment may override it", async () => {
    const at = await dir({ ".env": "API_TOKEN=placeholder" });

    const env = await loadEnv({
      manifest: manifest({}),
      name: "local",
      dir: at,
      processEnv: { API_TOKEN: "from-ci" },
    });

    expect(env.API_TOKEN).toBe("from-ci");
  });
});
