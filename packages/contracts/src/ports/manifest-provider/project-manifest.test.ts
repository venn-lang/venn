import { describe, expect, it } from "vitest";
import { createTomlManifest } from "./toml-manifest.js";

function load(content: string) {
  return createTomlManifest({ content }).load();
}

const PACKAGE = `[package]
name = "checkout"
version = "1.4.0"
license = "MIT"
authors = ["Ada"]

[lib]

[[bin]]
name = "server"

[[bin]]
name = "seed"
path = "tools/seed.vn"

[dependencies]
zod = "^4"
shared = { path = "../shared" }
hono = { version = "^4", optional = true }
fmt = { workspace = true }

[dev-dependencies]
faker = "^9"

[patch]
zod = "4.0.1"

[profile.release]
strict = false

[tooling]
manager = "bun"`;

describe("what a manifest says a package is", () => {
  it("reads the package table whole", () => {
    const { package: pkg } = load(PACKAGE);

    expect(pkg.name).toBe("checkout");
    expect(pkg.license).toBe("MIT");
    expect(pkg.authors).toEqual(["Ada"]);
  });

  /** A server is a `bin` that does not end, so there is no third kind here. */
  it("reads a lib and every bin, each with where it starts", () => {
    expect(load(PACKAGE).targets).toEqual([
      { kind: "lib", name: "checkout", path: "src/lib.vn" },
      { kind: "bin", name: "server", path: "src/bin/server.vn" },
      { kind: "bin", name: "seed", path: "tools/seed.vn" },
    ]);
  });

  it("reads both spellings of a dependency into one shape", () => {
    const deps = load(PACKAGE).dependencies;

    expect(deps).toContainEqual({
      name: "zod",
      version: "^4",
      fromWorkspace: false,
      optional: false,
    });
    expect(deps.find((d) => d.name === "shared")?.path).toBe("../shared");
    expect(deps.find((d) => d.name === "hono")?.optional).toBe(true);
    expect(deps.find((d) => d.name === "fmt")?.fromWorkspace).toBe(true);
  });

  it("keeps dev dependencies and patches apart from the rest", () => {
    const manifest = load(PACKAGE);

    expect(manifest.devDependencies.map((d) => d.name)).toEqual(["faker"]);
    expect(manifest.patch.map((d) => d.name)).toEqual(["zod"]);
  });

  /** What is written wins over the default; what is not written keeps it. */
  it("layers a profile over the built-in one", () => {
    const { profiles } = load(PACKAGE);

    expect(profiles.release).toEqual({ strict: false });
    expect(profiles.dev).toEqual({ strict: false });
  });

  it("takes the package manager named, and pnpm when none is", () => {
    expect(load(PACKAGE).tooling.manager).toBe("bun");
    expect(load("[package]\nname = 'x'").tooling.manager).toBe("pnpm");
  });

  /** A manifest from a newer toolchain should still open. */
  it("falls back rather than failing on a manager it does not know", () => {
    expect(load("[tooling]\nmanager = 'deno'").tooling.manager).toBe("pnpm");
  });

  it("says a plain package is not a workspace", () => {
    expect(load(PACKAGE).workspace).toBeUndefined();
  });
});

const WORKSPACE = `[workspace]
members = ["packages/*", "apps/*"]
exclude = ["packages/legacy"]
default-members = ["apps/web"]

[workspace.package]
version = "2.0.0"
license = "Apache-2.0"
name = "ignorado"

[workspace.dependencies]
zod = "^4"

[package]
name = "raiz"`;

describe("what a manifest says a workspace is", () => {
  it("reads members, exclusions and the default set", () => {
    const workspace = load(WORKSPACE).workspace;

    expect(workspace?.members).toEqual(["packages/*", "apps/*"]);
    expect(workspace?.exclude).toEqual(["packages/legacy"]);
    expect(workspace?.defaultMembers).toEqual(["apps/web"]);
  });

  it("reads the versions a member may inherit", () => {
    const workspace = load(WORKSPACE).workspace;

    expect(workspace?.package.version).toBe("2.0.0");
    expect(workspace?.dependencies.map((d) => d.name)).toEqual(["zod"]);
  });

  /** The one field that must differ between two members is never inherited. */
  it("never lets a name be inherited", () => {
    expect(load(WORKSPACE).workspace?.package.name).toBeUndefined();
  });

  /** Cargo allows a root that is also a package, and the two never merge. */
  it("lets a root be a package as well", () => {
    expect(load(WORKSPACE).name).toBe("raiz");
  });
});
