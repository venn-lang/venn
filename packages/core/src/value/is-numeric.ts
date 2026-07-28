import { isUnitValue, type Numeric } from "../units/index.js";

/** True for plain numbers and unit values (duration/size/percent). */
export function isNumeric(value: unknown): value is Numeric {
  return typeof value === "number" || isUnitValue(value);
}
