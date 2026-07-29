import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import { ancestors } from "./ancestors.js";
import { resolveVersion, describe as summarise } from "./resolve-version.js";
import { selectVersion } from "./select-version.js";

async function fsWith(files: Record<string, string>): Promise<FileSystem> {
  const fs = createMemoryFs();
  const encoder = new TextEncoder();
  for (const [path, content] of Object.entries(files)) {
    await fs.write(path, encoder.encode(content));
  }
  return fs;
}

const MANIFEST = '[package]\nname = "api"\nvenn = "0.2.0"\n';

describe("walking up from a directory", () => {
  it("visits each directory above it, nearest first", () => {
    expect(ancestors("/work/api/tests")).toEqual(["/work/api/tests", "/work/api", "/work", "/"]);
  });

  it("ends at the drive on windows", () => {
    expect(ancestors("C:\\work\\api")).toEqual(["C:/work/api", "C:/work", "C:/"]);
  });

  it("has nowhere to go from the root", () => {
    expect(ancestors("/")).toEqual(["/"]);
  });
});

describe("which version a directory is asking for", () => {
  it("reads the pin a project declares in its manifest", async () => {
    const fs = await fsWith({ "/work/api/venn.toml": MANIFEST });

    const resolved = await resolveVersion({ fs, directory: "/work/api" });

    expect(resolved).toEqual({
      range: "0.2.0",
      source: "manifest",
      from: "/work/api/venn.toml",
    });
  });

  /** A command run inside a project is run on that project's language. */
  it("finds the project's pin from a directory inside it", async () => {
    const fs = await fsWith({ "/work/api/venn.toml": MANIFEST });

    const resolved = await resolveVersion({ fs, directory: "/work/api/tests/http" });

    expect(resolved.range).toBe("0.2.0");
    expect(resolved.from).toBe("/work/api/venn.toml");
  });

  it("reads a version file where there is no project", async () => {
    const fs = await fsWith({ "/scratch/.venn-version": "0.3.1\n" });

    const resolved = await resolveVersion({ fs, directory: "/scratch" });

    expect(resolved).toEqual({
      range: "0.3.1",
      source: "file",
      from: "/scratch/.venn-version",
    });
  });

  /** The rest of the file is room to say why the version is pinned. */
  it("takes only the first line of a version file", async () => {
    const fs = await fsWith({
      "/scratch/.venn-version": "0.3.1\n\nheld back: the parser changed\n",
    });

    expect((await resolveVersion({ fs, directory: "/scratch" })).range).toBe("0.3.1");
  });

  /**
   * The manifest is where a project's decisions live, so a version file beside
   * it is either older or somebody's local experiment.
   */
  it("prefers the manifest when both are there", async () => {
    const fs = await fsWith({
      "/work/api/venn.toml": MANIFEST,
      "/work/api/.venn-version": "0.9.9",
    });

    expect((await resolveVersion({ fs, directory: "/work/api" })).source).toBe("manifest");
  });

  /** The nearest pin wins, so a member of a workspace can hold itself back. */
  it("takes the nearest pin, not the highest", async () => {
    const fs = await fsWith({
      "/work/venn.toml": '[package]\nname = "root"\nvenn = "0.1.0"\n',
      "/work/api/venn.toml": MANIFEST,
    });

    expect((await resolveVersion({ fs, directory: "/work/api" })).range).toBe("0.2.0");
  });

  it("falls back to the default when nothing asks", async () => {
    const fs = await fsWith({ "/work/readme.md": "no manifest here" });

    const resolved = await resolveVersion({ fs, directory: "/work", defaultVersion: "0.1.3" });

    expect(resolved).toEqual({ range: "0.1.3", source: "default", from: undefined });
  });

  /** Nothing asked, so anything installed answers and the newest one wins. */
  it("asks for anything when nothing pins and nothing is chosen", async () => {
    const fs = await fsWith({ "/work/readme.md": "nothing" });

    const resolved = await resolveVersion({ fs, directory: "/work" });

    expect(resolved).toEqual({ range: "*", source: "none", from: undefined });
  });
});

describe("a manifest that pins nothing", () => {
  it("is passed over, since most projects will not pin at all", async () => {
    const fs = await fsWith({ "/work/venn.toml": '[package]\nname = "api"\n' });

    const resolved = await resolveVersion({ fs, directory: "/work", defaultVersion: "0.1.3" });

    expect(resolved.source).toBe("default");
  });

  /** A broken manifest is the compiler's to complain about, with a location. */
  it("is passed over when it cannot be parsed, rather than failing here", async () => {
    const fs = await fsWith({ "/work/venn.toml": "[package\nname = broken" });

    const resolved = await resolveVersion({ fs, directory: "/work", defaultVersion: "0.1.3" });

    expect(resolved.source).toBe("default");
  });

  it("is passed over when the pin is empty", async () => {
    const fs = await fsWith({ "/work/venn.toml": '[package]\nvenn = "   "\n' });

    const resolved = await resolveVersion({ fs, directory: "/work", defaultVersion: "0.1.3" });

    expect(resolved.source).toBe("default");
  });
});

describe("explaining the answer", () => {
  const installed = ["0.1.3", "0.2.0", "0.2.4"];

  async function explain(files: Record<string, string>, defaultVersion?: string): Promise<string> {
    const fs = await fsWith(files);
    const request = await resolveVersion({ fs, directory: "/work/api", defaultVersion });
    return summarise(selectVersion({ request, installed }));
  }

  it("names the file that decided", async () => {
    const line = await explain({ "/work/api/venn.toml": MANIFEST });

    expect(line).toBe("0.2.0, as asked, pinned by /work/api/venn.toml");
  });

  /** A range asked for more than one version, so which one it got matters. */
  it("says which version a range turned out to mean", async () => {
    const line = await explain({ "/work/api/venn.toml": `[package]\nvenn = "0.2.x"\n` });

    expect(line).toBe("0.2.4, the newest matching 0.2.x, pinned by /work/api/venn.toml");
  });

  it("says the default was used and why", async () => {
    const line = await explain({ "/work/api/readme.md": "x" }, "0.1.3");

    expect(line).toContain("the default");
  });

  it("says it took the newest when nothing asked", async () => {
    expect(await explain({ "/work/api/readme.md": "x" })).toBe("0.2.4, the newest installed");
  });

  it("says what was asked for when nothing installed matches", async () => {
    const fs = await fsWith({ "/work/api/venn.toml": `[package]\nvenn = "9.x"\n` });
    const request = await resolveVersion({ fs, directory: "/work/api" });

    const line = summarise(selectVersion({ request, installed }));

    expect(line).toBe("no installed version matches 9.x, asked for by /work/api/venn.toml");
  });

  it("says plainly when there is nothing installed at all", async () => {
    const fs = await fsWith({ "/work/api/readme.md": "x" });
    const request = await resolveVersion({ fs, directory: "/work/api" });

    const line = summarise(selectVersion({ request, installed: [] }));

    expect(line).toBe("no version of the language is installed");
  });
});
