import { isInstant, isUnitValue, type Numeric } from "../units/index.js";

/** True for plain numbers, unit values (duration/size/percent) and moments. */
export function isNumeric(value: unknown): value is Numeric {
  return typeof value === "number" || isUnitValue(value) || isInstant(value);
}
