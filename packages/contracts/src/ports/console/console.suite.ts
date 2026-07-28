import { describe, expect, it } from "vitest";
import type { Console } from "./console.types.js";

/**
 * The {@link Console} TCK.
 *
 * `out` is optional on the spec so an implementation that cannot be read back
 * still runs the input half of the suite.
 */
export function consoleConformance(spec: {
  name: string;
  factory: (input?: readonly string[]) => Console & { out?: string };
}): void {
  describe(`Console · ${spec.name}`, () => {
    it("reads scripted lines in order, then null at the end", async () => {
      const console = spec.factory(["first", "second"]);

      expect(await console.readLine()).toBe("first");
      expect(await console.readLine()).toBe("second");
      expect(await console.readLine()).toBeNull();
    });

    it("returns null immediately when there is no input", async () => {
      expect(await spec.factory().readLine()).toBeNull();
    });

    it("writes without adding a newline of its own", () => {
      const console = spec.factory();
      console.write("a");
      console.write("b");
      if (console.out !== undefined) expect(console.out).toBe("ab");
    });
  });
}
