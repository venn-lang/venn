import type { ActionContext, ActionInput } from "@venn/sdk";
import { describe, expect, it } from "vitest";
import { type ArtifactStore, createMemoryArtifactStore } from "../store/index.js";
import { attachAction } from "./attach.js";
import { flushAction } from "./flush.js";
import { saveAction } from "./save.js";

function ctxWith(store: ArtifactStore): ActionContext {
  return { port: () => store } as unknown as ActionContext;
}

function input(args: readonly unknown[], params: unknown = {}): ActionInput<unknown> {
  return { args, params };
}

describe("artifacts actions", () => {
  it("save records one artifact per kind and list returns them", async () => {
    const store = createMemoryArtifactStore();
    const refs = await saveAction.run(ctxWith(store), input(["trace", "video", "har"]));
    expect(refs).toHaveLength(3);
    expect(await store.list()).toHaveLength(3);
  });

  it("flush drains the pending buffer while list keeps the refs", async () => {
    const store = createMemoryArtifactStore();
    const ctx = ctxWith(store);
    await saveAction.run(ctx, input(["trace"]));
    expect(await flushAction.run(ctx, input([]))).toHaveLength(1);
    expect(await store.list()).toHaveLength(1);
  });

  it("attach stores a named artifact with kind and size", async () => {
    const store = createMemoryArtifactStore();
    await attachAction.run(ctxWith(store), input(["report.html"], { kind: "report", size: 2048 }));
    expect(await store.get("report.html")).toMatchObject({
      name: "report.html",
      kind: "report",
      size: 2048,
    });
  });
});
