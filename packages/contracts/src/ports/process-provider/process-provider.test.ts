import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createFakeProcess } from "./fake-process.js";
import { createNodeSpawn } from "./node-spawn.js";
import { processProviderConformance } from "./process-provider.suite.js";

/** Node running a one-liner: the one command every machine here certainly has. */
const SAYS_OI = ["-e", "process.stdout.write('oi'); process.exit(3)"];

processProviderConformance({
  name: "fake",
  factory: () => createFakeProcess({ exitCode: 3, output: "oi" }),
  runs: { command: "qualquer" },
  expected: { code: 3, output: "oi" },
});

processProviderConformance({
  name: "node-spawn",
  factory: () => createNodeSpawn(),
  runs: { command: process.execPath, args: SAYS_OI },
  expected: { code: 3, output: "oi" },
});

const roots: string[] = [];

afterAll(async () => {
  for (const dir of roots) await rm(dir, { recursive: true, force: true });
});

/** What only the real one can be asked: it is the only one with a machine. */
describe("what a real subprocess does with where and what it is given", () => {
  it("runs where it was told to", async () => {
    const dir = await mkdtemp(join(tmpdir(), "venn-proc-"));
    roots.push(dir);
    const proc = createNodeSpawn();

    const result = await proc
      .spawn({
        command: process.execPath,
        args: ["-e", "process.stdout.write(process.cwd())"],
        cwd: dir,
      })
      .wait();

    expect(result.output).toContain(dir.split(/[\\/]/).pop() as string);
  });

  it("adds to the environment rather than replacing it", async () => {
    const proc = createNodeSpawn();

    const result = await proc
      .spawn({
        command: process.execPath,
        args: ["-e", "process.stdout.write(`${process.env.VENN_X}|${!!process.env.PATH}`)"],
        env: { VENN_X: "posto" },
      })
      .wait();

    expect(result.output).toContain("posto|true");
  });

  it("keeps what a command wrote to stderr", async () => {
    const proc = createNodeSpawn();

    const result = await proc
      .spawn({ command: process.execPath, args: ["-e", "process.stderr.write('ruim')"] })
      .wait();

    expect(result.output).toContain("ruim");
  });

  /** A command that cannot start is a command that ran and failed, with a reason. */
  it("reports a command that does not exist instead of throwing", async () => {
    const proc = createNodeSpawn();

    const result = await proc.spawn({ command: "venn-nao-existe-mesmo" }).wait();

    expect(result.code).not.toBe(0);
  });
});
