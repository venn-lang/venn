import { makeSecret } from "./secret.js";
import type { SecretProvider } from "./secret-provider.types.js";

/**
 * The real one: secrets from `process.env`.
 *
 * The `process` global is probed rather than imported, so this file stays
 * neutral and reports every name as absent in a Worker instead of throwing.
 */
export function createEnvSecrets(): SecretProvider {
  const env: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env;
  return {
    get: (name) => {
      const value = env[name];
      return value === undefined ? undefined : makeSecret({ reveal: value });
    },
    has: (name) => env[name] !== undefined,
  };
}
