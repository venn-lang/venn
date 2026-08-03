import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import { insideWorkspace } from "./inside-workspace.js";

const WORKSPACE = '[workspace]\nmembers = ["packages/*"]\n';

/** A disk holding one manifest, which is all any of these needs. */
async function diskWith(path: string, content: string): Promise<FileSystem> {
  const fs = createMemoryFs();
  await fs.write(path, new TextEncoder().encode(content));
  return fs;
}

/** The same disk, remembering every path the walk asked about. */
function watching(fs: FileSystem): { fs: FileSystem; probed: string[] } {
  const probed: string[] = [];
  const exists = (path: string): Promise<boolean> => {
    probed.push(path);
    return fs.exists(path);
  };
  return { fs: { ...fs, exists }, probed };
}

describe("whether a new package lands inside a workspace", () => {
  it("says yes when the workspace above names it", async () => {
    const fs = await diskWith("C:/work/venn.toml", WORKSPACE);

    expect(await insideWorkspace({ fs, dir: "C:/work/packages/api" })).toBe(true);
  });

  it("says no when the workspace above does not name it", async () => {
    const fs = await diskWith("C:/work/venn.toml", WORKSPACE);

    expect(await insideWorkspace({ fs, dir: "C:/work/apps/web" })).toBe(false);
  });
});

/**
 * The walk fell off the drive root into the empty string, and the empty string
 * is the working directory. `venn new` then wrote a member manifest, with no
 * version and no `.gitignore`, for a package inside no workspace.
 */
describe("a manifest below the root of the path", () => {
  it("cannot claim a package above it", async () => {
    const disk = watching(await diskWith("venn.toml", '[workspace]\nmembers = ["*/*/*"]\n'));

    const claimed = await insideWorkspace({ fs: disk.fs, dir: "C:/somewhere/new/app" });

    expect(claimed).toBe(false);
    expect(disk.probed).toEqual(PROBED);
  });
});

const PROBED = ["C:/somewhere/new/venn.toml", "C:/somewhere/venn.toml", "C:/venn.toml"];
