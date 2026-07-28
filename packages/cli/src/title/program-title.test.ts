import { describe, expect, it } from "vitest";
import { programTitle } from "./program-title.js";
import { setProgramTitle } from "./set-program-title.js";

describe("programTitle", () => {
  it("names the program by its command and its file", () => {
    expect(programTitle({ command: "run", target: "e:/work/examples/server.vn" })).toBe(
      "venn run server.vn",
    );
  });

  it("drops the path, which no tab is wide enough for", () => {
    expect(programTitle({ command: "test", target: "a/very/deep/tree/checkout.vn" })).toBe(
      "venn test checkout.vn",
    );
  });

  it("still says who it is with nothing to point at", () => {
    expect(programTitle({ command: "run" })).toBe("venn run");
  });

  it("stays short enough to read", () => {
    const title = programTitle({ command: "test", target: `${"x".repeat(200)}.vn` });

    expect(title.length).toBeLessThanOrEqual(60);
  });
});

describe("setProgramTitle", () => {
  it("names the running process after the program, not after node", () => {
    const before = process.title;
    try {
      setProgramTitle({ command: "run", target: "server.vn" });

      expect(process.title).toBe("venn run server.vn");
    } finally {
      process.title = before;
    }
  });
});
