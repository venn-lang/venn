/**
 * Enough of the VS Code API to activate the extension outside an editor, and
 * the controls to drive it: add a folder, touch a pin, tear the window down.
 *
 * The extension host is not something a test can start, so the alternative was
 * leaving the wiring uncovered and hearing from a user that changing a pin does
 * nothing. `vitest.config.ts` points `vscode` here.
 */

type Listener<T> = (event: T) => void;

/** What every registration hands back, and what disposing it does: nothing. */
export interface Disposable {
  dispose(): void;
}

export interface StubFolder {
  name: string;
  index: number;
  uri: { fsPath: string; toString(): string };
}

export interface FolderChange {
  added: StubFolder[];
  removed: StubFolder[];
}

/** Registered listeners, so a test can fire what the editor would fire. */
class Fires<T> {
  private readonly listeners: Listener<T>[] = [];

  readonly on: (listener: Listener<T>) => Disposable = (listener) => {
    this.listeners.push(listener);
    return { dispose: (): void => {} };
  };

  fire(event: T): void {
    for (const listener of this.listeners) listener(event);
  }
}

export class Watcher {
  readonly changed: Fires<unknown> = new Fires();
  readonly created: Fires<unknown> = new Fires();
  readonly deleted: Fires<unknown> = new Fires();
  readonly onDidChange: (listener: Listener<unknown>) => Disposable = this.changed.on;
  readonly onDidCreate: (listener: Listener<unknown>) => Disposable = this.created.on;
  readonly onDidDelete: (listener: Listener<unknown>) => Disposable = this.deleted.on;
  dispose(): void {}
}

/** What the editor did, and the handles to make it do more. */
export interface Editor {
  folders: StubFolder[];
  lines: string[];
  watchers: { glob: string; watcher: Watcher }[];
  folderChanges: Fires<FolderChange>;
  disposed: number;
  reset(): void;
  folder(name: string): StubFolder;
  touchPins(): void;
}

export const editor: Editor = {
  folders: [],
  lines: [],
  watchers: [],
  folderChanges: new Fires<FolderChange>(),
  disposed: 0,

  reset(): void {
    editor.folders = [];
    editor.lines = [];
    editor.watchers = [];
    editor.folderChanges = new Fires<FolderChange>();
    editor.disposed = 0;
  },

  /** A folder in the window, named and keyed the way a real one is. */
  folder(name: string): StubFolder {
    return { name, index: 0, uri: { fsPath: `/w/${name}`, toString: () => `file:///w/${name}` } };
  },

  /** Every watcher the extension registered fires, as one write would. */
  touchPins(): void {
    for (const { watcher } of editor.watchers) watcher.changed.fire({});
  },
};

export interface Channel extends Disposable {
  appendLine(line: string): void;
}

export const window: { createOutputChannel(name: string): Channel } = {
  createOutputChannel(_name: string): Channel {
    return {
      appendLine: (line: string): void => {
        editor.lines.push(line);
      },
      dispose: (): void => {},
    };
  },
};

export interface Workspace {
  readonly workspaceFolders: StubFolder[];
  onDidChangeWorkspaceFolders(listener: Listener<FolderChange>): Disposable;
  createFileSystemWatcher(glob: string): Watcher;
}

export const workspace: Workspace = {
  get workspaceFolders(): StubFolder[] {
    return editor.folders;
  },
  onDidChangeWorkspaceFolders(listener: Listener<FolderChange>): Disposable {
    return editor.folderChanges.on(listener);
  },
  createFileSystemWatcher(glob: string): Watcher {
    const watcher = new Watcher();
    editor.watchers.push({ glob, watcher });
    return watcher;
  },
};

/** What `context.subscriptions` collects, counted rather than kept. */
export function context(): { subscriptions: Disposable[] } {
  const subscriptions = {
    push(...items: Disposable[]): number {
      editor.disposed += items.length;
      return items.length;
    },
  };
  return { subscriptions: subscriptions as unknown as Disposable[] };
}
