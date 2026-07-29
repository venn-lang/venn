import { defineConfig } from "vitest/config";

// The scripts are not a package and ship nothing, but they decide the changelog
// and the release notes, and a mistake there is only noticed by what is missing
// from a release. That is worth a test.
export default defineConfig({
  test: {
    name: "scripts",
    include: ["*.test.mjs"],
  },
});
