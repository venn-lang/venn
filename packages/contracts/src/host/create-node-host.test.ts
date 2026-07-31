import { sep } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeHost } from "./create-node-host.js";

/**
 * The one thing a program must never decide for itself.
 *
 * A host that writes the wrong separator is not caught by anything downstream:
 * the path is built, handed to the disk, and fails somewhere far from here.
 */
describe("the host the CLI runs on", () => {
  it("spells paths the way this machine does", () => {
    const host = createNodeHost();

    expect(host.paths.separator).toBe(sep);
    expect(host.paths.join(["a", "b"])).toBe(`a${sep}b`);
  });

  it("starts relative paths where the process is", () => {
    expect(createNodeHost().paths.cwd()).toBe(process.cwd());
  });

  /** A root is where relative paths resolve, for the file system and for these alike. */
  it("starts them where it was told to instead, when it was told", () => {
    const host = createNodeHost({ root: `${sep}srv` });

    expect(host.paths.resolve(["app"])).toBe(`${sep}srv${sep}app`);
  });
});
