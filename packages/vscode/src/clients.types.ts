import type { WorkspaceFolder } from "vscode";

/** A running server, as much of one as deciding when to run it needs to know. */
export interface Session {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** Starts a server for a folder. The real one is a language client. */
export type Connect = (args: { folder: WorkspaceFolder; entry: string }) => Session;

/** Where a folder's server is, or why there is none. */
export type ServerFor =
  | { readonly kind: "found"; readonly version: string; readonly entry: string }
  | { readonly kind: "missing"; readonly reason: string };

/** Asks which server answers for a folder. The real one asks the toolchain. */
export type Find = (folder: string) => Promise<ServerFor>;

/** What the clients report, so the decisions can be watched without an editor. */
export type Say = (line: string) => void;
