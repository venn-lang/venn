import type { FileSystem } from "@venn/contracts";
import { join } from "../paths/index.js";
import { outputDir, type ProfileName } from "./layout.js";

/** One target a build covered, and where it starts. */
export interface BuiltTarget {
  package: string;
  kind: string;
  name: string;
  /** The entry file, relative to the workspace root. */
  path: string;
}

/** What one build covered, and how it went. */
export interface BuildRecord {
  profile: ProfileName;
  targets: readonly BuiltTarget[];
  /** How many `.vn` files were read, and how many problems were found. */
  files: number;
  problems: number;
}

/** The record's name, inside the profile's output directory. */
export const RECORD_FILE = "build.json";

/**
 * Writes what a build produced, where that build's outputs go.
 *
 * It answers "what does this project build, and did it hold together", and it
 * is what an incremental build compares against once there is generated code to
 * skip.
 *
 * @returns The path written.
 * @throws Whatever the file system raises when the write fails.
 */
export async function writeBuildRecord(args: {
  fs: FileSystem;
  root: string;
  record: BuildRecord;
}): Promise<string> {
  const path = join(outputDir({ root: args.root, profile: args.record.profile }), RECORD_FILE);
  const text = `${JSON.stringify(args.record, null, 2)}\n`;
  await args.fs.write(path, new TextEncoder().encode(text));
  return path;
}
