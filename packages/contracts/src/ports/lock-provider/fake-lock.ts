import type { LockProvider } from "./lock-provider.types.js";

/** The double: grants immediately and serialises nothing. */
export function createFakeLock(): LockProvider {
  return { acquire: async () => () => {} };
}
