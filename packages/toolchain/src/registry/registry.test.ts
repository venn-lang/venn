import { describe, expect, it } from "vitest";
import { catalogueOf } from "./catalogue-of.js";
import { readCatalogue } from "./read-catalogue.js";
import type { FetchJson } from "./registry.types.js";
import { nothingPublishedFor, releaseFor } from "./release-for.js";

/** The shape npmjs answers with, trimmed to what is read. */
const DOCUMENT = {
  "dist-tags": { latest: "0.1.3", next: "0.2.0-rc.1" },
  versions: {
    "0.1.0": { dist: { tarball: "https://r/cli-0.1.0.tgz", integrity: "sha512-a" } },
    "0.1.3": { dist: { tarball: "https://r/cli-0.1.3.tgz", integrity: "sha512-b" } },
    "0.2.0": { dist: { tarball: "https://r/cli-0.2.0.tgz", integrity: "sha512-c" } },
    "0.2.0-rc.1": { dist: { tarball: "https://r/cli-0.2.0-rc.1.tgz", integrity: "sha512-d" } },
  },
};

const CATALOGUE = readCatalogue(DOCUMENT);

describe("reading what the registry answered", () => {
  it("takes the versions, the tags and where each one is", () => {
    expect(CATALOGUE.versions).toEqual(["0.1.0", "0.1.3", "0.2.0", "0.2.0-rc.1"]);
    expect(CATALOGUE.tags.latest).toBe("0.1.3");
    expect(CATALOGUE.releases["0.1.3"]).toEqual({
      version: "0.1.3",
      tarball: "https://r/cli-0.1.3.tgz",
      integrity: "sha512-b",
    });
  });

  /**
   * A version with no tarball cannot be installed and one with no hash cannot
   * be checked. Offering either would only fail later and further away.
   */
  it("leaves out a version that could not be installed anyway", () => {
    const catalogue = readCatalogue({
      versions: {
        "1.0.0": { dist: { tarball: "https://r/a.tgz", integrity: "sha512-a" } },
        "1.1.0": { dist: { tarball: "https://r/b.tgz" } },
        "1.2.0": { dist: {} },
        "1.3.0": {},
      },
    });

    expect(catalogue.versions).toEqual(["1.0.0"]);
  });

  it("reads an answer that is not what was expected as an empty one", () => {
    for (const answer of [undefined, null, "gone", 42, []]) {
      const catalogue = readCatalogue(answer);

      expect(catalogue.versions).toEqual([]);
      expect(catalogue.tags).toEqual({});
    }
  });
});

describe("which release answers a request", () => {
  it("looks a tag up rather than reading it as a range", () => {
    expect(releaseFor({ catalogue: CATALOGUE, request: "latest" })?.version).toBe("0.1.3");
    expect(releaseFor({ catalogue: CATALOGUE, request: "next" })?.version).toBe("0.2.0-rc.1");
  });

  it("takes an exact version", () => {
    expect(releaseFor({ catalogue: CATALOGUE, request: "0.1.0" })?.version).toBe("0.1.0");
  });

  it("takes the newest published matching a range", () => {
    expect(releaseFor({ catalogue: CATALOGUE, request: "0.1.x" })?.version).toBe("0.1.3");
    expect(releaseFor({ catalogue: CATALOGUE, request: "*" })?.version).toBe("0.2.0");
  });

  /** The same rule as for installed versions: a prerelease is asked for by name. */
  it("does not offer a prerelease to a range that did not ask", () => {
    expect(releaseFor({ catalogue: CATALOGUE, request: "0.2.x" })?.version).toBe("0.2.0");
  });

  it("has nothing for a version that was never published", () => {
    expect(releaseFor({ catalogue: CATALOGUE, request: "9.9.9" })).toBeUndefined();
  });

  it("says what is there instead", () => {
    const said = nothingPublishedFor({ catalogue: CATALOGUE, request: "9.x" });

    expect(said).toContain("9.x");
    expect(said).toContain("0.1.3");
  });

  it("says so when the registry lists nothing at all", () => {
    const said = nothingPublishedFor({ catalogue: readCatalogue({}), request: "1.0.0" });

    expect(said).toContain("no versions");
  });
});

describe("asking the registry", () => {
  it("asks for the package by its published name, at the registry given", async () => {
    const asked: string[] = [];
    const fetchJson: FetchJson = async (url) => {
      asked.push(url);
      return DOCUMENT;
    };

    await catalogueOf({ fetchJson, registry: "https://mirror.example" });

    expect(asked).toEqual(["https://mirror.example/%40venn-lang%2Fcli"]);
  });

  it("defaults to npmjs", async () => {
    const asked: string[] = [];
    const fetchJson: FetchJson = async (url) => {
      asked.push(url);
      return DOCUMENT;
    };

    await catalogueOf({ fetchJson });

    expect(asked[0]).toContain("registry.npmjs.org");
  });

  it("lets a failure through rather than answering with an empty catalogue", async () => {
    const fetchJson: FetchJson = async () => {
      throw new Error("the registry answered 500");
    };

    await expect(catalogueOf({ fetchJson })).rejects.toThrow("500");
  });
});
