import type { Profile } from "../project.types.js";
import { asBoolean, asRecord } from "./scalars.js";

/**
 * What each build is for, and what that costs.
 *
 * `dev` reports what it finds and carries on, because a project being worked on
 * is half-written most of the time. `release` refuses to build over a problem.
 * Neither has to be written in a manifest for the defaults to apply.
 */
export const DEFAULT_PROFILES: Readonly<Record<string, Profile>> = {
  dev: { strict: false },
  release: { strict: true },
};

/** `[profile.<name>]`, merged over {@link DEFAULT_PROFILES}. */
export function readProfiles(data: Record<string, unknown>): Record<string, Profile> {
  const out: Record<string, Profile> = { ...DEFAULT_PROFILES };
  for (const [name, table] of Object.entries(asRecord(data.profile))) {
    out[name] = { ...out[name], ...readProfile(asRecord(table)) };
  }
  return out;
}

function readProfile(table: Record<string, unknown>): Profile {
  const found: Profile = {};
  for (const key of ["strict"] as const) {
    const value = asBoolean(table[key]);
    if (value !== undefined) found[key] = value;
  }
  return found;
}
