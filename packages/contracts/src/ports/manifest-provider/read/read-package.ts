import type { PackageInfo } from "../project.types.js";
import { asList, asRecord, asString } from "./scalars.js";

/** `[package]`: who this is. A missing table reads as a nameless package. */
export function readPackage(data: Record<string, unknown>): PackageInfo {
  const table = asRecord(data.package);
  return {
    name: String(table.name ?? ""),
    version: asString(table.version),
    description: asString(table.description),
    license: asString(table.license),
    authors: asList(table.authors),
  };
}

/**
 * The same table, reduced to what a member may inherit from its workspace.
 *
 * A name is never inherited, being the one thing that must differ between two
 * members, so `[workspace.package]` carrying one is read as carrying none.
 */
export function readInheritable(data: Record<string, unknown>): Partial<PackageInfo> {
  const table = asRecord(data);
  const found: Partial<PackageInfo> = {};
  for (const key of ["version", "description", "license"] as const) {
    const value = asString(table[key]);
    if (value !== undefined) found[key] = value;
  }
  const authors = asList(table.authors);
  return authors.length > 0 ? { ...found, authors } : found;
}
