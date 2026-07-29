import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { activate, deactivate } from "./extension.js";
import { context, editor } from "./vscode.stub.js";

const found = vi.hoisted(() => ({ current: "0.2.0" }));

vi.mock("./find-server.js", () => ({
  serverFor: async () => ({
    kind: "found",
    version: found.current,
    entry: `/versions/${found.current}/venn-lsp.mjs`,
  }),
}));

const started: string[] = [];

vi.mock("./connect.js", () => ({
  connect: ({ entry }: { entry: string }) => ({
    start: async () => {
      started.push(entry);
    },
    stop: async () => {},
  }),
}));

beforeEach(() => {
  editor.reset();
  started.length = 0;
  found.current = "0.2.0";
});

function activateWith(...names: string[]): void {
  editor.folders = names.map((name) => editor.folder(name));
  activate(context() as unknown as ExtensionContext);
}

/** Activation is asynchronous inside, and nothing hands back a promise. */
const settled = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("activating the extension", () => {
  it("starts a server for every folder already open", async () => {
    activateWith("api", "site");
    await settled();

    expect(started).toEqual(["/versions/0.2.0/venn-lsp.mjs", "/versions/0.2.0/venn-lsp.mjs"]);
  });

  it("watches the files a version can be pinned in", () => {
    activateWith("api");

    expect(editor.watchers.map((each) => each.glob)).toEqual(["**/{venn.toml,.venn-version}"]);
  });

  /**
   * The requirement this was built for: editing `.venn-version` and then
   * wondering why the editor still disagrees with the command line is the whole
   * problem. Waiting for a window reload is not an answer.
   */
  it("restarts on the version a pin was changed to, without a reload", async () => {
    activateWith("api");
    await settled();

    found.current = "0.3.0";
    editor.touchPins();
    await settled();

    expect(started).toEqual(["/versions/0.2.0/venn-lsp.mjs", "/versions/0.3.0/venn-lsp.mjs"]);
  });

  it("leaves a folder alone when the pin was written but says the same thing", async () => {
    activateWith("api");
    await settled();

    editor.touchPins();
    await settled();

    expect(started).toEqual(["/versions/0.2.0/venn-lsp.mjs"]);
  });

  it("starts a server for a folder added to the window", async () => {
    activateWith();
    await settled();

    editor.folderChanges.fire({ added: [editor.folder("late")], removed: [] });
    await settled();

    expect(started).toEqual(["/versions/0.2.0/venn-lsp.mjs"]);
  });

  it("registers the output channel and the watcher for disposal", () => {
    activateWith("api");

    expect(editor.disposed).toBe(3);
  });

  it("stops everything when it is deactivated", async () => {
    activateWith("api");
    await settled();

    await deactivate();

    expect(editor.lines.at(-1)).toContain("starting Venn 0.2.0");
  });
});
