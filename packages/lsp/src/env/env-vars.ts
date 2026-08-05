import { REDACTED } from "@venn-lang/contracts";
import type { EnvVar } from "./env.types.js";

/**
 * Words that mean the value is a credential. Matched per segment, never as a
 * substring: `KEYCLOAK_URL` contains "key" and is just a URL.
 */
const SECRET_WORDS = new Set([
  "pass",
  "passwd",
  "password",
  "secret",
  "token",
  "key",
  "apikey",
  "credential",
  "credentials",
  "auth",
]);

/**
 * True when the name reads like a credential, so its value is never shown.
 *
 * A hover that prints a password during a screen share leaks it, so redaction
 * belongs at the producer (§16), which is here, not in whatever renders the
 * tooltip.
 */
export function isSecretName(name: string): boolean {
  return segmentsOf(name).some((segment) => SECRET_WORDS.has(segment));
}

/** `ADMIN_PASSWORD` and `adminPassword` both split into `admin`, `password`. */
function segmentsOf(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Flatten `[env.local]`, `[env.ci]`… into one declared variable per name, each
 * carrying the comment written above it. `venn.toml` is where an environment
 * variable is documented, the same way `##` documents a declaration.
 */
export function envVars(
  sections: Record<string, Record<string, string>>,
  docs: Record<string, string> = {},
): EnvVar[] {
  const found = new Map<string, EnvVar>();
  for (const [environment, vars] of Object.entries(sections)) {
    for (const [name, value] of Object.entries(vars)) {
      record({ found, name, environment, value, doc: docs[name] });
    }
  }
  const declared = [...found.values()];
  return declared.length > 0 ? [selectedEnvironment(sections), ...declared] : declared;
}

/** `env.name` is not in the file: the runner sets it to whichever `--env` ran. */
function selectedEnvironment(sections: Record<string, Record<string, string>>): EnvVar {
  return {
    name: "name",
    doc: "The environment this run selected, from `--env`.",
    secret: false,
    values: Object.keys(sections).map((environment) => ({ environment, value: environment })),
  };
}

function record(args: {
  found: Map<string, EnvVar>;
  name: string;
  environment: string;
  value: string;
  doc?: string;
}): void {
  const secret = isSecretName(args.name);
  const entry = { environment: args.environment, value: secret ? REDACTED : args.value };
  const existing = args.found.get(args.name);
  if (existing) existing.values.push(entry);
  else args.found.set(args.name, { name: args.name, doc: args.doc, secret, values: [entry] });
}

/** Just the declared names: what the checker matches reads against. */
export function envNames(sections: Record<string, Record<string, string>>): string[] {
  return envVars(sections).map((variable) => variable.name);
}
