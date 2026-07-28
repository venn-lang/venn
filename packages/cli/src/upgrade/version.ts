import { createRequire } from "node:module";

/**
 * The version of the CLI that is running.
 *
 * Read from the package manifest rather than written into the source, so a
 * release cannot ship a binary that reports the version before it. The manifest
 * sits one level above the bundle, which is true both in `dist` and in `src`
 * during development.
 */
export const VERSION: string = read();

function read(): string {
  try {
    const require = createRequire(import.meta.url);
    const manifest = require("../../package.json") as { version?: string };
    return manifest.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
