import { typeName } from "@venn-lang/core";
import type { ParamSpec } from "@venn-lang/sdk";
import { durationMs } from "./duration-ms.js";

/**
 * What is wrong with a value written against a declared option, in the words a
 * reader would use, or nothing when it is fine.
 *
 * Asked by the checker of what is written and by the runtime of what it
 * evaluated to, so the same sentence arrives whether the value is a literal or
 * came out of a variable. `concurrency: "3"` used to fall back in silence, and
 * a quoted number is exactly what a value that came through an environment
 * variable looks like.
 */
export function outsideItsDomain(spec: ParamSpec, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (spec.values) return oneOf(spec, value);
  if (spec.type === "number") return typeof value === "number" ? undefined : needs(spec, value);
  if (spec.type === "duration")
    return durationMs(value) === undefined ? aTime(spec, value) : undefined;
  return undefined;
}

function oneOf(spec: ParamSpec, value: unknown): string | undefined {
  const accepted = spec.values ?? [];
  if (typeof value === "string" && accepted.includes(value)) return undefined;
  return `"${String(value)}" is not a ${spec.name} this understands. Accepted: ${accepted.join(", ")}.`;
}

function needs(spec: ParamSpec, value: unknown): string {
  return `${spec.name} needs a number, and this is a ${typeName(value)}.`;
}

function aTime(spec: ParamSpec, value: unknown): string {
  return `${spec.name} needs a length of time, as in 10s, and this is a ${typeName(value)}.`;
}
