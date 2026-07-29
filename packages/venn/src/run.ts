import { homedir } from "node:os";
import { createNodeFs } from "@venn-lang/contracts/node";
import { createFetchBytes, createFetchJson, vennHome } from "@venn-lang/toolchain";
import { execute } from "./execute.js";
import { handOver } from "./hand-over.js";

/**
 * The real surroundings: a disk, a network, a terminal.
 *
 * The only place any of those are reached for. Everything the orchestrator
 * decides lives in {@link execute}, which is handed them, so the decisions can
 * be exercised without any of it.
 *
 * @param argv Everything after the binary name.
 * @returns The exit code to leave with.
 */
export function run(argv: readonly string[]): Promise<number> {
  return execute({
    argv,
    where: {
      fs: createNodeFs(),
      home: vennHome({ env: process.env, home: homedir() }),
      cwd: process.cwd(),
      fetchJson: createFetchJson(),
      fetchBytes: createFetchBytes(),
      handOver,
      say: (line) => {
        process.stderr.write(`${line}\n`);
      },
    },
  });
}
