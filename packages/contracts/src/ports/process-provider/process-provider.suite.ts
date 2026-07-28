import { describe, expect, it } from "vitest";
import type { ConformanceSpec } from "../../conformance/index.js";
import type { ProcessProvider, SpawnArgs } from "./process-provider.types.js";

/**
 * The {@link ProcessProvider} TCK.
 *
 * Each implementation is asked to run something that says a known thing and
 * ends with a known code. *What* it is asked to run differs, since a fake has
 * no shell and the real one has no script, but the answer must not.
 */
export function processProviderConformance(
  spec: ConformanceSpec<ProcessProvider> & {
    runs: SpawnArgs;
    expected: { code: number; output: string };
  },
): void {
  describe(`ProcessProvider · ${spec.name}`, () => {
    it("waits for the command and reports how it ended", async () => {
      const proc = await spec.factory();

      const result = await proc.spawn(spec.runs).wait();

      expect(result.code).toBe(spec.expected.code);
      expect(result.output).toContain(spec.expected.output);
    });

    /** Half a minute of silence reads as a command that has hung. */
    it("streams what the command writes, as it writes it", async () => {
      const proc = await spec.factory();
      const seen: string[] = [];

      await proc.spawn({ ...spec.runs, onOutput: (chunk) => seen.push(chunk) }).wait();

      expect(seen.join("")).toContain(spec.expected.output);
    });

    it("hands back a handle that can be asked to stop", async () => {
      const proc = await spec.factory();
      const handle = proc.spawn(spec.runs);

      expect(typeof handle.pid).toBe("number");
      expect(() => handle.kill()).not.toThrow();
    });
  });
}
