import { describe, expect, it } from "vitest";
import { modulesDir, nativeModulesDir, outputDir, targetDir } from "./layout.js";

/**
 * Where the derived things go.
 *
 * The placement of `node_modules` is load-bearing, not tidiness: Node resolves
 * a package by walking up from the importing file, and built output sits one
 * level below the modules, so the ordinary resolver finds them with no loader
 * and no symlink. These assertions are the shape that property depends on.
 */
describe("the target directory", () => {
  it("puts everything derived under one directory at the root", () => {
    expect(targetDir("/repo")).toBe("/repo/target");
    expect(modulesDir("/repo")).toBe("/repo/target/node_modules");
    expect(nativeModulesDir("/repo")).toBe("/repo/target/native_modules");
  });

  it("gives each profile its own output directory", () => {
    expect(outputDir({ root: "/repo", profile: "debug" })).toBe("/repo/target/debug");
    expect(outputDir({ root: "/repo", profile: "release" })).toBe("/repo/target/release");
  });

  /** Built output must sit below the modules for Node's resolver to find them. */
  it("keeps the output one level below the modules it will import", () => {
    const modules = modulesDir("/repo");
    const output = outputDir({ root: "/repo", profile: "release" });

    expect(output.split("/").length).toBe(modules.split("/").length);
    expect(output.startsWith(`${targetDir("/repo")}/`)).toBe(true);
  });
});
