/**
 * A value that redacts itself. Serialising one, by any route, yields the
 * redaction marker: redaction happens at the producer, because redacting in the
 * UI is already too late.
 */
export interface Secret {
  /** The only way to the raw value, and deliberately something you must ask for. */
  reveal(): string;
  toString(): string;
  toJSON(): string;
}

/** Resolves `secrets.*` names to redaction-marked values. */
export interface SecretProvider {
  get(name: string): Secret | undefined;
  has(name: string): boolean;
}
