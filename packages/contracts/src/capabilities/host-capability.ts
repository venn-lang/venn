/**
 * Every capability a Host may expose. A port or plugin declares which it
 * requires, a host advertises which it provides, and negotiation compares the
 * two before anything binds.
 */
export const ALL_CAPABILITIES = [
  "fs",
  "process",
  "net",
  "clock",
  "random",
  "secrets",
  "log",
  "io",
] as const;

/** One capability name, drawn from {@link ALL_CAPABILITIES}. */
export type HostCapability = (typeof ALL_CAPABILITIES)[number];
