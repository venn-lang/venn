import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * A Python that actually runs.
 *
 * On Windows the `python` on PATH is often the Microsoft Store's stub, which
 * prints an advert and exits — so a candidate only counts once it has answered
 * a trivial program.
 */
export function findPython(): string | undefined {
  for (const candidate of [process.env.VENN_PYTHON, "python3", "python", ...installed()]) {
    if (candidate && answers(candidate)) return candidate;
  }
  return undefined;
}

function answers(command: string): boolean {
  const probe = spawnSync(command, ["-c", "print(7*6)"], { encoding: "utf8" });
  return probe.status === 0 && probe.stdout.trim() === "42";
}

/** Where the official Windows installer puts it when PATH was left alone. */
function installed(): string[] {
  const local = process.env.LOCALAPPDATA;
  if (!local) return [];
  const root = join(local, "Programs", "Python");
  try {
    return readdirSync(root).map((version) => join(root, version, "python.exe"));
  } catch {
    return [];
  }
}
