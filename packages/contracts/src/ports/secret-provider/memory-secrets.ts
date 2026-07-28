import { makeSecret } from "./secret.js";
import type { SecretProvider } from "./secret-provider.types.js";

/**
 * The double: secrets given by name, wrapped so they still redact.
 *
 * @param args.values - the raw values, keyed by secret name.
 */
export function createMemorySecrets(args: { values: Record<string, string> }): SecretProvider {
  const values = args.values;
  return {
    get: (name) => (name in values ? makeSecret({ reveal: values[name] as string }) : undefined),
    has: (name) => name in values,
  };
}
