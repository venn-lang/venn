import { describe, expect, it } from "vitest";
import { manifestProviderConformance } from "./manifest.suite.js";
import { createMemoryManifest } from "./memory-manifest.js";
import { createTomlManifest } from "./toml-manifest.js";

const TOML = `[package]
name = "acme-checkout"
version = "1.4.0"

[paths]
"#shared" = "./src/shared"

[env.staging]
BASE_URL = "https://staging.acme.dev"

[env.local]
BASE_URL = "http://localhost:3000"`;

manifestProviderConformance({
  name: "toml",
  expectedName: "acme-checkout",
  factory: () => createTomlManifest({ content: TOML }),
});

manifestProviderConformance({
  name: "memory",
  expectedName: "inline",
  factory: () =>
    createMemoryManifest({
      manifest: { name: "inline", version: "0" },
    }),
});

describe("toml manifest parsing", () => {
  it("reads package, paths, and per-environment variables", () => {
    const manifest = createTomlManifest({ content: TOML }).load();
    expect(manifest.version).toBe("1.4.0");
    expect(manifest.paths["#shared"]).toBe("./src/shared");
    expect(manifest.env.staging?.BASE_URL).toBe("https://staging.acme.dev");
    expect(manifest.env.local?.BASE_URL).toBe("http://localhost:3000");
  });
});
