import type { Surroundings } from "../execute.js";

/**
 * Writes the version every directory that does not ask falls back to.
 *
 * One version rather than a range: it is the answer for everything that did
 * not ask, and an answer that moves when something else is installed is not
 * one.
 *
 * @param args Where versions live, and the version to fall back to.
 */
export async function writeDefault(args: { where: Surroundings; version: string }): Promise<void> {
  const content = new TextEncoder().encode(`${args.version}\n`);
  await args.where.fs.write(`${args.where.home}/default`, content);
}
