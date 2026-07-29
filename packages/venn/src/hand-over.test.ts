import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handOver } from "./hand-over.js";

/** A script standing in for the language, which only has to end a certain way. */
async function scriptThat(body: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "venn-handover-"));
  const path = join(directory, "entry.mjs");
  await writeFile(path, body, "utf8");
  return path;
}

describe("handing the command over", () => {
  it("gives back the exit code, which is what CI reads", async () => {
    const entry = await scriptThat("process.exit(3);");

    expect(await handOver({ entry, args: [] })).toBe(3);
  });

  it("gives back zero when it succeeds", async () => {
    const entry = await scriptThat("process.exit(0);");

    expect(await handOver({ entry, args: [] })).toBe(0);
  });

  it("passes the arguments through untouched", async () => {
    const entry = await scriptThat(
      "process.exit(process.argv.slice(2).join('|') === 'test|--reporter|dot' ? 0 : 9);",
    );

    expect(await handOver({ entry, args: ["test", "--reporter", "dot"] })).toBe(0);
  });

  /** A quoted argument holding a space is one argument, not two. */
  it("keeps an argument that holds a space whole", async () => {
    const entry = await scriptThat("process.exit(process.argv.slice(2).length === 1 ? 0 : 9);");

    expect(await handOver({ entry, args: ["--flow=the health endpoint answers"] })).toBe(0);
  });

  /** Failing to start is a failure, not a silent zero. */
  it("reports a failure when there is nothing to run", async () => {
    expect(await handOver({ entry: "/nowhere/at/all.mjs", args: [] })).toBe(1);
  });
});
