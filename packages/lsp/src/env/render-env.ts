import { code, fence, labelled, rule, sections } from "../markdown/index.js";
import type { EnvVar } from "./env.types.js";

/**
 * Hover for `env.NAME`: what it is for, then what it is set to per environment.
 * Secrets show that they exist without showing what they are.
 */
export function envHover(variable: EnvVar): string {
  return rule([
    fence(`env.${variable.name}`),
    sections([variable.doc, valuesBlock(variable), secretNote(variable)]),
    "**Declared in** `venn.toml`",
  ]);
}

function valuesBlock(variable: EnvVar): string {
  const values = variable.values
    .map((entry) => `- ${code(entry.environment)}: ${code(entry.value)}`)
    .join("\n");
  return labelled("Value", values);
}

function secretNote(variable: EnvVar): string | undefined {
  return variable.secret ? "Reads like a credential, so the value is never printed." : undefined;
}
