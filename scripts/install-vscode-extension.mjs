// Install (or refresh) the Venn extension in the locally installed VS Code.
//
// VS Code keeps an index of installed extensions (`extensions.json`), copying a
// folder into `extensions/` is silently ignored. So we package a `.vsix` and let
// the `code` CLI register it properly. Re-running replaces the previous build;
// reload the window afterwards to pick it up.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION = join(ROOT, "packages", "vscode");
const VSIX = join(EXTENSION, "venn.vsix");
const ID = "venn.venn";

// `code` and `pnpm` are `.cmd` shims on Windows, which Node only runs through a
// shell. Passing one pre-quoted string (rather than an args array) keeps that safe.
function run(command, options = {}) {
  const result = spawnSync(command, { cwd: options.cwd ?? ROOT, stdio: "inherit", shell: true });
  if (result.status !== 0 && !options.tolerant) throw new Error(`command failed: ${command}`);
  return result.status === 0;
}

function requireCodeCli() {
  const probe = spawnSync("code --version", { shell: true, encoding: "utf8" });
  if (probe.status === 0) return;
  throw new Error(
    "The `code` CLI was not found on PATH.\n" +
      "In VS Code: Ctrl+Shift+P → \"Shell Command: Install 'code' command in PATH\".",
  );
}

function install() {
  if (!existsSync(join(EXTENSION, "dist", "extension.cjs"))) {
    throw new Error("Extension is not built. Run: pnpm vscode:build");
  }
  run("pnpm exec vsce package --no-dependencies --out venn.vsix", { cwd: EXTENSION });
  run(`code --install-extension "${VSIX}" --force`);
  console.log('\nReload VS Code: Ctrl+Shift+P → "Developer: Reload Window".');
}

requireCodeCli();
if (process.argv.includes("--remove")) {
  run(`code --uninstall-extension ${ID}`, { tolerant: true });
  console.log(`removed ${ID}, reload VS Code to finish.`);
} else {
  install();
}
