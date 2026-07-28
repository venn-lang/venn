import { isUnitValue } from "../units/index.js";

/** Boolean coercion for `!`, `&&`, `||`, and `if` conditions. */
export function truthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (value === 0 || value === "") return false;
  if (isUnitValue(value)) return true;
  return Boolean(value);
}
