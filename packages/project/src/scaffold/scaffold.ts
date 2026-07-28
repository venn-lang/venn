// biome-ignore-all lint/suspicious/noTemplateCurlyInString: ${name} is Venn's own interpolation inside a generated file, not a JavaScript template.
import { TARGET_DIR } from "../target/index.js";
import type { ScaffoldFile, ScaffoldRequest } from "./scaffold.types.js";

/**
 * The files a new project starts as.
 *
 * Pure: it says what should exist and the caller writes it, so `--dry-run`, the
 * tests and the disk all see one answer. What is generated is deliberately
 * small, because a starting point that has to be deleted before it can be used
 * is worse than one that is missing something.
 *
 * @returns The manifest, a source file for anything that is not a workspace,
 * and a `.gitignore` unless a workspace above already owns one.
 */
export function scaffold(request: ScaffoldRequest): ScaffoldFile[] {
  const files = [{ path: "venn.toml", content: manifestFor(request) }];
  if (request.kind !== "workspace") files.push(sourceFor(request));
  // One `target/` per workspace means one line ignoring it, at the root that
  // owns it. A member repeating that would be ignoring something it has not got.
  if (!request.insideWorkspace) files.push(ignoreFile());
  return files;
}

/** A member leaves out what it inherits; writing it down would only shadow it. */
function manifestFor(request: ScaffoldRequest): string {
  if (request.kind === "workspace") return workspaceManifest();
  const version = request.insideWorkspace ? [] : ['version = "0.1.0"'];
  return ["[package]", `name = "${request.name}"`, ...version, "", "[dependencies]", ""].join("\n");
}

function workspaceManifest(): string {
  return [
    "[workspace]",
    'members = ["packages/*"]',
    "",
    "# Metadata a member inherits by leaving it out.",
    "[workspace.package]",
    'version = "0.1.0"',
    "",
    "# Versions a member takes with `dep = { workspace = true }`.",
    "[workspace.dependencies]",
    "",
  ].join("\n");
}

/** A library exports; a program runs. Each starts as the smallest of itself. */
function sourceFor(request: ScaffoldRequest): ScaffoldFile {
  if (request.kind === "lib") {
    return {
      path: "src/lib.vn",
      content: ["pub fn greet(name: string) -> string {", '  "Hello, ${name}"', "}", ""].join("\n"),
    };
  }
  return { path: "src/main.vn", content: `print "Hello from ${request.name}"\n` };
}

/** Everything derived lives in one directory, so ignoring it is one line. */
function ignoreFile(): ScaffoldFile {
  return { path: ".gitignore", content: `${TARGET_DIR}/\n` };
}
