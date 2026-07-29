import type { TarFile } from "./tar.types.js";

/** Every tar header and every chunk of content is padded to this. */
const BLOCK = 512;

/** Where each field this reads begins, and how long it is. */
const NAME = { at: 0, length: 100 };
const SIZE = { at: 124, length: 12 };
const TYPE = 156;
const PREFIX = { at: 345, length: 155 };

/** `0` is a regular file, and so is a NUL, which older writers used instead. */
const REGULAR = new Set(["0", "\0"]);

/**
 * The regular files in a tar archive, in the order they appear.
 *
 * Everything else is skipped rather than interpreted: directories arrive
 * implicitly with the files inside them, and a symlink, a hard link or a device
 * node has no business coming out of a package tarball. An archive that holds
 * only those simply yields nothing.
 *
 * Names are returned as the archive gave them. Deciding whether a name is safe
 * to write belongs to whoever is writing, which knows where.
 *
 * @param bytes The archive, already decompressed.
 * @returns Each regular file, with its content.
 */
export function readTar(bytes: Uint8Array): TarFile[] {
  const files: TarFile[] = [];
  let at = 0;
  while (at + BLOCK <= bytes.length) {
    const header = bytes.subarray(at, at + BLOCK);
    const name = nameIn(header);
    if (name === "") return files;
    const size = sizeIn(header);
    const start = at + BLOCK;
    if (REGULAR.has(typeIn(header))) {
      files.push({ name, bytes: bytes.subarray(start, start + size) });
    }
    at = start + padded(size);
  }
  return files;
}

/** Two blocks of zeroes end an archive, and a zero name is the first of them. */
function nameIn(header: Uint8Array): string {
  const name = textIn(header, NAME);
  const prefix = textIn(header, PREFIX);
  if (name === "") return "";
  return prefix === "" ? name : `${prefix}/${name}`;
}

function typeIn(header: Uint8Array): string {
  return String.fromCharCode(header[TYPE] ?? 0);
}

/**
 * Octal, space or NUL terminated. A size that is not a number reads as zero,
 * which skips the entry rather than walking off into the middle of a file and
 * reading its content as the next header.
 */
function sizeIn(header: Uint8Array): number {
  const parsed = Number.parseInt(textIn(header, SIZE), 8);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function textIn(header: Uint8Array, field: { at: number; length: number }): string {
  const raw = header.subarray(field.at, field.at + field.length);
  const end = raw.indexOf(0);
  return new TextDecoder().decode(end === -1 ? raw : raw.subarray(0, end)).trim();
}

function padded(size: number): number {
  return Math.ceil(size / BLOCK) * BLOCK;
}
