export { compileTemplate } from "./compile-template.js";
export { interpolateText } from "./interpolate-text.js";
export type { InterpolationSlot } from "./interpolation.types.js";
export { joinTemplate } from "./join-template.js";
export {
  placeholderEnd,
  scanInterpolations,
  unclosedPlaceholder,
} from "./scan-interpolations.js";
export { displayValue, stringifyValue } from "./stringify-value.js";
export type { Template, TemplateHole } from "./template.types.js";
