import { VennError } from "@venn/contracts";
import type { LoadRunner } from "./load-runner.types.js";

/**
 * The traffic-generating `LoadRunner`. Not wired up in this build.
 *
 * @returns a runner whose `run` throws, so the gap is a legible failure rather
 * than metrics nobody measured.
 * @throws {VennError} `VN8090` on every `run`.
 */
export function createRealLoadRunner(): LoadRunner {
  return {
    run: async () => notImplemented(),
  };
}

function notImplemented(): never {
  throw new VennError({
    code: "VN8090",
    message: "The load runner is not implemented in this build.",
  });
}
