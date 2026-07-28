import { describe, expect, it } from "vitest";
import { createFakePreviewProvider } from "./fake-preview.js";
import { createNonePreviewProvider } from "./none-preview.js";

describe("preview providers", () => {
  it("fake yields a frame only once the worker is started", async () => {
    const preview = createFakePreviewProvider();
    expect(preview.latestFrame({ worker: 0 })).toBeUndefined();
    await preview.start({ worker: 0 });
    expect(preview.latestFrame({ worker: 0 })?.mime).toBe("image/jpeg");
    await preview.stop({ worker: 0 });
    expect(preview.latestFrame({ worker: 0 })).toBeUndefined();
  });

  it("none never yields a frame", async () => {
    const preview = createNonePreviewProvider();
    await preview.start({ worker: 0 });
    expect(preview.latestFrame({ worker: 0 })).toBeUndefined();
  });
});
