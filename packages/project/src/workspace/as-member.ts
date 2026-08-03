import type { Manifest } from "@venn-lang/contracts";
import { reanchor } from "../paths/index.js";
import { inherit } from "./inherit.js";

/**
 * A member's manifest as it is actually read: what the workspace root supplies
 * filled in, and the aliases that came from above rewritten to mean the same
 * place from down here.
 *
 * One answer, because there are two readers: the CLI loads a package from disk
 * and the editor reads the nearest `venn.toml` out of its own index, and a
 * member whose settings differ between them is red in one and green in the
 * other.
 *
 * @param args.manifest The member's own manifest, as written.
 * @param args.dir Where that member lives.
 * @param args.from The workspace root's manifest.
 * @param args.fromDir Where the root lives, which is what its paths mean.
 * @returns The merged manifest. A root with no `[workspace]` supplies nothing
 * and the member comes back untouched.
 */
export function asMember(args: {
  manifest: Manifest;
  dir: string;
  from: Manifest;
  fromDir: string;
}): Manifest {
  const merged = inherit({ manifest: args.manifest, from: args.from });
  if (args.fromDir === args.dir) return merged;
  return { ...merged, paths: anchored(merged, args) };
}

/**
 * An alias the member wrote itself is already anchored where it will be read,
 * so only the ones that came from above move. Hence the member's own table is
 * consulted rather than the merged one.
 */
function anchored(
  merged: Manifest,
  args: { manifest: Manifest; dir: string; fromDir: string },
): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const [alias, value] of Object.entries(merged.paths)) {
    const mine = args.manifest.paths[alias] !== undefined;
    paths[alias] = mine
      ? value
      : reanchor({ path: value, declaredIn: args.fromDir, usedIn: args.dir });
  }
  return paths;
}
