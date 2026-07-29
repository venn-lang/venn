import { homedir } from "node:os";
import { createNodeFs } from "@venn-lang/contracts/node";
import { planFor, vennHome } from "@venn-lang/toolchain";
import type { ServerFor } from "./clients.types.js";

/**
 * The server for a folder: the same version its commands would run on.
 *
 * Asked of the toolchain rather than bundled, so a folder pinned to `0.2.0`
 * gets diagnostics from `0.2.0` and `venn check` agrees with what the editor
 * underlines. An editor that disagrees with the command line is worse than one
 * that says nothing, because there is no way to tell which is right.
 *
 * @param folder The workspace folder, which may pin a version of its own.
 * @returns Where the server is, or a sentence for the editor to show.
 */
export async function serverFor(folder: string): Promise<ServerFor> {
  const fs = createNodeFs();
  const home = vennHome({ env: process.env, home: homedir() });
  const plan = await planFor({ fs, home, directory: folder, kind: "lsp" });

  if (plan.kind === "run") {
    return { kind: "found", version: plan.version, entry: plan.entry };
  }
  if (plan.kind === "install") {
    return { kind: "missing", reason: notInstalled(plan.request) };
  }
  return { kind: "missing", reason: plan.reason };
}

/**
 * Says what to run rather than running it. Installing a compiler is not
 * something an editor should decide to do while somebody is typing.
 */
function notInstalled(request: string): string {
  return `Venn ${request} is not installed. Run "venn version install ${request}" to get it`;
}
