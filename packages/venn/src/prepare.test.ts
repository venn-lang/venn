import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import { type Preparation, prepare } from "./prepare.js";

const HOME = "/home/v/.venn";

const CATALOGUE = {
  "dist-tags": { latest: "0.2.0" },
  versions: { "0.2.0": { dist: { tarball: "https://r/a.tgz", integrity: "sha512-a" } } },
};

interface Watched {
  where: Preparation;
  said: string[];
  fetched: string[];
}

function preparation(overrides: Partial<Preparation> = {}): Watched {
  const said: string[] = [];
  const fetched: string[] = [];
  const where: Preparation = {
    fs: createMemoryFs(),
    home: HOME,
    fetchJson: async () => CATALOGUE,
    fetchBytes: async (url) => record(fetched, url),
    say: (line) => said.push(line),
    ...overrides,
  };
  return { said, fetched, where };
}

/** Notes what would have been downloaded, and hands back nothing. */
async function record(fetched: string[], url: string): Promise<Uint8Array> {
  fetched.push(url);
  return new Uint8Array(0);
}

async function alreadyInstalled(fs: FileSystem): Promise<void> {
  const root = `${HOME}/versions/0.1.3`;
  const manifest = JSON.stringify({ bin: { "venn-run": "./dist/bin/venn-run.mjs" } });
  await fs.write(`${root}/package.json`, new TextEncoder().encode(manifest));
  await fs.write(`${root}/dist/bin/venn-run.mjs`, new TextEncoder().encode("x"));
}

describe("preparing on install", () => {
  /**
   * The install must not fail over this. It is an optimisation: the language
   * arrives on first use instead, a few seconds later, once.
   */
  it("does not throw when the registry cannot be reached", async () => {
    const watched = preparation({
      fetchJson: async () => {
        throw new Error("offline");
      },
    });

    await expect(prepare(watched.where)).resolves.toBeUndefined();
    expect(watched.said[0]).toContain("fetched on first use");
  });

  it("does not throw when the download fails", async () => {
    const watched = preparation({
      fetchBytes: async () => {
        throw new Error("connection reset");
      },
    });

    await expect(prepare(watched.where)).resolves.toBeUndefined();
    expect(watched.said[0]).toContain("fetched on first use");
  });

  /** Reinstalling the orchestrator should not refetch a language that is here. */
  it("fetches nothing when a version is already installed", async () => {
    const watched = preparation();
    await alreadyInstalled(watched.where.fs);

    await prepare(watched.where);

    expect(watched.fetched).toEqual([]);
    expect(watched.said).toEqual([]);
  });
});
