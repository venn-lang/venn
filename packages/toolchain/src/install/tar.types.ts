/** One regular file taken out of a tar archive. */
export interface TarFile {
  /** The path the archive gave, with no interpretation applied. */
  readonly name: string;
  readonly bytes: Uint8Array;
}
