import { fc, test } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { type ConformanceSpec, expectVennError } from "../../conformance/index.js";
import type { FileSystem } from "./file-system.types.js";

/** The {@link FileSystem} TCK. Real and double both run it. */
export function fileSystemConformance(spec: ConformanceSpec<FileSystem>): void {
  describe(`FileSystem · ${spec.name}`, () => {
    it("read returns exactly the bytes written", async () => {
      const fs = await spec.factory();
      const bytes = new Uint8Array([1, 2, 3, 4]);
      await fs.write("a.bin", bytes);
      expect(await fs.read("a.bin")).toEqual(bytes);
    });

    it("reading a missing path fails with VN8, never a raw error", async () => {
      const fs = await spec.factory();
      await expectVennError({ op: () => fs.read("missing.bin"), code: /^VN8/ });
    });

    it("exists reflects write then remove", async () => {
      const fs = await spec.factory();
      await fs.write("k.bin", new Uint8Array([0]));
      expect(await fs.exists("k.bin")).toBe(true);
      await fs.remove("k.bin");
      expect(await fs.exists("k.bin")).toBe(false);
    });

    /**
     * Bounded in both draws and payload, because `node-fs` runs this against a
     * real disk. Twenty-five draws demonstrate last-write-wins as well as
     * fast-check's default hundred, and the raised timeout means a loaded
     * machine reports a slow disk rather than a failure.
     */
    test.prop([fc.uint8Array({ maxLength: 4096 })], { numRuns: 25 })(
      "write is last-write-wins",
      async (bytes) => {
        const fs = await spec.factory();
        await fs.write("k.bin", new Uint8Array([9]));
        await fs.write("k.bin", bytes);
        expect(await fs.read("k.bin")).toEqual(bytes);
      },
      20_000,
    );

    /**
     * A workspace's `members = ["packages/*"]` rests on listing, so the two
     * implementations have to agree about it. The double has no directories at
     * all, only paths, which is exactly why this is asked of both.
     */
    it("lists what a directory holds, one level deep", async () => {
      const fs = await spec.factory();
      await fs.write("pkg/a/venn.toml", new Uint8Array([1]));
      await fs.write("pkg/b/venn.toml", new Uint8Array([1]));
      await fs.write("pkg/top.txt", new Uint8Array([1]));

      const names = (await fs.list("pkg")).map((entry) => entry.name).sort();
      expect(names).toEqual(["a", "b", "top.txt"]);
    });

    it("says which of them hold more", async () => {
      const fs = await spec.factory();
      await fs.write("root/inside/deep.txt", new Uint8Array([1]));
      await fs.write("root/flat.txt", new Uint8Array([1]));

      const found = await fs.list("root");
      expect(found.find((entry) => entry.name === "inside")?.directory).toBe(true);
      expect(found.find((entry) => entry.name === "flat.txt")?.directory).toBe(false);
    });

    /** Asking what is inside something that holds nothing has an answer. */
    it("reads a path that is not a directory as empty", async () => {
      const fs = await spec.factory();
      expect(await fs.list("nao/existe")).toEqual([]);
    });
  });
}
