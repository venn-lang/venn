/**
 * Read and write bytes.
 *
 * This is the port that lets `@venn/core` run both in Node (the CLI) and in a
 * Web Worker (the LSP). A leaked `import fs from "node:fs"` in core would break
 * the editor, so all byte I/O goes through here.
 */
export interface FileSystem {
  /** @throws VennError VN8010 when the path does not exist. */
  read(path: string): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** @throws VennError VN8010 when the path does not exist. */
  remove(path: string): Promise<void>;
  /**
   * What a directory holds, one level deep, in no promised order. A path that
   * is not a directory reads as empty rather than raising: asking what is
   * inside something that holds nothing has an answer.
   */
  list(path: string): Promise<readonly DirEntry[]>;
}

/** One name inside a directory, and whether it holds more. */
export interface DirEntry {
  name: string;
  directory: boolean;
}
