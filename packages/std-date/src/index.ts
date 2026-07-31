// The `date` namespace: a clock, a pattern, and a place on earth.
export { dateActions, PARTS_TYPE } from "./actions/date-actions.js";
export { formatParts, type Parts, partsIn } from "./format/format-instant.js";
export { datePlugin, datePlugin as default } from "./plugin.js";
