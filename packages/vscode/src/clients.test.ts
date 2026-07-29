import { beforeEach, describe, expect, it } from "vitest";
import type { WorkspaceFolder } from "vscode";
import { Clients } from "./clients.js";
import type { Connect, Find, ServerFor, Session } from "./clients.types.js";

/**
 * A folder is only ever asked for its path, its name and a key, so this is all
 * of one that deciding when to restart a server can see.
 */
function folder(name: string): WorkspaceFolder {
  return {
    name,
    index: 0,
    uri: { fsPath: `/w/${name}`, toString: () => `file:///w/${name}` },
  } as WorkspaceFolder;
}

/** Every start and stop, in the order they happened. */
let log: string[] = [];
let said: string[] = [];
/** What each folder is answered with, changed between calls to move a pin. */
let answers = new Map<string, ServerFor>();

beforeEach(() => {
  log = [];
  said = [];
  answers = new Map();
});

const find: Find = async (path) =>
  answers.get(path) ?? { kind: "missing", reason: "nothing installed" };

const connect: Connect = ({ folder: which, entry }): Session => ({
  start: async () => {
    log.push(`start ${which.name} ${entry}`);
  },
  stop: async () => {
    log.push(`stop ${which.name}`);
  },
});

function clients(): Clients {
  return new Clients({ find, connect, say: (line) => said.push(line) });
}

function answer(path: string, version: string): void {
  answers.set(path, { kind: "found", version, entry: `/versions/${version}/venn-lsp.mjs` });
}

describe("a server per workspace folder", () => {
  it("starts one on the version the folder asked for", async () => {
    answer("/w/api", "0.2.0");

    await clients().open(folder("api"));

    expect(log).toEqual(["start api /versions/0.2.0/venn-lsp.mjs"]);
    expect(said).toEqual(["api: starting Venn 0.2.0"]);
  });

  /** Two folders in one window can want two versions, and each gets its own. */
  it("gives two folders two servers", async () => {
    answer("/w/api", "0.2.0");
    answer("/w/site", "0.1.3");
    const started = clients();

    await started.open(folder("api"));
    await started.open(folder("site"));

    expect(log).toEqual([
      "start api /versions/0.2.0/venn-lsp.mjs",
      "start site /versions/0.1.3/venn-lsp.mjs",
    ]);
  });

  /**
   * The watcher fires on any write to `venn.toml`, most of which leave the
   * version alone. Restarting on each would throw away the state of a server
   * that was answering perfectly well.
   */
  it("does not restart a folder whose version did not move", async () => {
    answer("/w/api", "0.2.0");
    const started = clients();
    await started.open(folder("api"));

    await started.open(folder("api"));

    expect(log).toEqual(["start api /versions/0.2.0/venn-lsp.mjs"]);
  });

  it("replaces the server when the pin moves, stopping the old one first", async () => {
    answer("/w/api", "0.1.3");
    const started = clients();
    await started.open(folder("api"));

    answer("/w/api", "0.2.0");
    await started.open(folder("api"));

    expect(log).toEqual([
      "start api /versions/0.1.3/venn-lsp.mjs",
      "stop api",
      "start api /versions/0.2.0/venn-lsp.mjs",
    ]);
  });

  /**
   * The pin moved to something that is not installed. Leaving the old server
   * running would underline the file with a compiler the folder no longer
   * uses, which is the disagreement this was built to end.
   */
  it("stops the server when the version it moved to is missing", async () => {
    answer("/w/api", "0.1.3");
    const started = clients();
    await started.open(folder("api"));

    answers.set("/w/api", { kind: "missing", reason: 'run "venn version install 0.9.9"' });
    await started.open(folder("api"));

    expect(log).toEqual(["start api /versions/0.1.3/venn-lsp.mjs", "stop api"]);
    expect(said.at(-1)).toBe('api: run "venn version install 0.9.9"');
  });

  it("says what is wrong when a folder has no server at all", async () => {
    await clients().open(folder("api"));

    expect(log).toEqual([]);
    expect(said).toEqual(["api: nothing installed"]);
  });

  it("starts again after the version that was missing is installed", async () => {
    const started = clients();
    await started.open(folder("api"));

    answer("/w/api", "0.2.0");
    await started.open(folder("api"));

    expect(log).toEqual(["start api /versions/0.2.0/venn-lsp.mjs"]);
  });

  it("stops a folder that was closed", async () => {
    answer("/w/api", "0.2.0");
    const started = clients();
    await started.open(folder("api"));

    await started.close(folder("api"));

    expect(log).toEqual(["start api /versions/0.2.0/venn-lsp.mjs", "stop api"]);
  });

  it("stops every server when the extension goes away", async () => {
    answer("/w/api", "0.2.0");
    answer("/w/site", "0.1.3");
    const started = clients();
    await started.open(folder("api"));
    await started.open(folder("site"));

    await started.closeAll();

    expect(log.slice(2).sort()).toEqual(["stop api", "stop site"]);
  });
});
