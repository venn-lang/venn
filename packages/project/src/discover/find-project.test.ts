import { createMemoryFs, type FileSystem } from "@venn/contracts";
import { describe, expect, it } from "vitest";
import { findProject } from "./find-project.js";

/** A disk with these files on it, each written as its text. */
async function diskOf(files: Record<string, string>): Promise<FileSystem> {
  const fs = createMemoryFs();
  const encoder = new TextEncoder();
  for (const [path, content] of Object.entries(files)) {
    await fs.write(path, encoder.encode(content));
  }
  return fs;
}

const ROOT = `[workspace]
members = ["packages/*"]
exclude = ["packages/antigo"]

[workspace.package]
version = "2.0.0"
license = "MIT"

[workspace.dependencies]
zod = "^4.2.0"`;

const WORKSPACE = {
  "venn.toml": ROOT,
  "packages/api/venn.toml": '[package]\nname = "api"\n\n[dependencies]\nzod = { workspace = true }',
  "packages/api/src/main.vn": "print 1",
  "packages/ui/venn.toml": '[package]\nname = "ui"\nversion = "9.9.9"',
  "packages/ui/src/lib.vn": "pub fn x() => 1",
  "packages/antigo/venn.toml": '[package]\nname = "antigo"',
  "packages/dist/nada.txt": "",
};

describe("finding the project a path belongs to", () => {
  it("finds a lone package from inside it", async () => {
    const fs = await diskOf({
      "app/venn.toml": '[package]\nname = "app"',
      "app/src/deep/inside.vn": "print 1",
    });

    const { project } = await findProject({ fs, from: "app/src/deep" });

    expect(project?.root).toBe("app");
    expect(project?.isWorkspace).toBe(false);
    expect(project?.packages.map((one) => one.manifest.name)).toEqual(["app"]);
  });

  it("says so when there is no manifest anywhere above", async () => {
    const fs = await diskOf({ "solto/a.vn": "print 1" });

    const { project, problems } = await findProject({ fs, from: "solto" });

    expect(project).toBeUndefined();
    expect(problems[0]?.code).toBe("VN2101");
  });

  it("climbs from a member to the workspace that owns it", async () => {
    const fs = await diskOf(WORKSPACE);

    const { project } = await findProject({ fs, from: "packages/api/src" });

    expect(project?.root).toBe("");
    expect(project?.isWorkspace).toBe(true);
    expect(project?.packages.map((one) => one.manifest.name).sort()).toEqual(["api", "ui"]);
  });

  it("drops an excluded member and anything with no manifest", async () => {
    const fs = await diskOf(WORKSPACE);

    const names = (await findProject({ fs, from: "." })).project?.packages.map(
      (one) => one.manifest.name,
    );

    expect(names).not.toContain("antigo");
    expect(names).not.toContain("dist");
  });

  /** Sitting inside someone's folder is not membership. */
  it("does not let an unlisted package join the workspace above it", async () => {
    const fs = await diskOf({
      ...WORKSPACE,
      "apps/web/venn.toml": '[package]\nname = "web"',
    });

    const { project } = await findProject({ fs, from: "apps/web" });

    expect(project?.isWorkspace).toBe(false);
    expect(project?.root).toBe("apps/web");
  });
});

describe("what a member inherits from its workspace", () => {
  it("takes the version and licence it did not write", async () => {
    const fs = await diskOf(WORKSPACE);

    const project = (await findProject({ fs, from: "." })).project;
    const api = project?.packages.find((one) => one.manifest.name === "api");

    expect(api?.manifest.version).toBe("2.0.0");
    expect(api?.manifest.package.license).toBe("MIT");
  });

  /** A default is a default: what the member wrote wins. */
  it("keeps the version the member wrote", async () => {
    const fs = await diskOf(WORKSPACE);

    const project = (await findProject({ fs, from: "." })).project;

    expect(project?.packages.find((one) => one.manifest.name === "ui")?.manifest.version).toBe(
      "9.9.9",
    );
  });

  it("fills in a dependency that asked to be told", async () => {
    const fs = await diskOf(WORKSPACE);

    const project = (await findProject({ fs, from: "." })).project;
    const api = project?.packages.find((one) => one.manifest.name === "api");

    expect(api?.manifest.dependencies[0]).toMatchObject({ name: "zod", version: "^4.2.0" });
  });
});

describe("what a package builds when it does not say", () => {
  it("reads src/main.vn as a program and src/lib.vn as a library", async () => {
    const fs = await diskOf(WORKSPACE);

    const project = (await findProject({ fs, from: "." })).project;
    const api = project?.packages.find((one) => one.manifest.name === "api");
    const ui = project?.packages.find((one) => one.manifest.name === "ui");

    expect(api?.targets).toEqual([{ kind: "bin", name: "api", path: "src/main.vn" }]);
    expect(ui?.targets).toEqual([{ kind: "lib", name: "ui", path: "src/lib.vn" }]);
  });

  it("reads each file in src/bin as another program", async () => {
    const fs = await diskOf({
      "app/venn.toml": '[package]\nname = "app"',
      "app/src/bin/seed.vn": "print 1",
      "app/src/bin/migrate.vn": "print 1",
    });

    const project = (await findProject({ fs, from: "app" })).project;

    expect(project?.packages[0]?.targets.map((one) => one.name)).toEqual(["migrate", "seed"]);
  });

  /** Writing `[lib]` with another path moves the library, never adds a second. */
  it("lets a declared target win over the convention", async () => {
    const fs = await diskOf({
      "app/venn.toml": '[package]\nname = "app"\n\n[lib]\npath = "outro.vn"',
      "app/src/lib.vn": "pub fn x() => 1",
    });

    const project = (await findProject({ fs, from: "app" })).project;

    expect(project?.packages[0]?.targets).toEqual([{ kind: "lib", name: "app", path: "outro.vn" }]);
  });
});
