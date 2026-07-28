import { addressSpecs } from "./address.js";
import { brazilSpecs } from "./brazil.js";
import { commerceSpecs } from "./commerce.js";
import { companySpecs } from "./company.js";
import { datetimeSpecs } from "./datetime.js";
import type { FakerSpec } from "./faker.types.js";
import { financeSpecs } from "./finance.js";
import { idSpecs } from "./ids.js";
import { internetSpecs } from "./internet.js";
import { personSpecs } from "./person.js";
import { textSpecs } from "./text.js";

/** Every `data.faker.*` verb. Adding a whole category is one line here. */
export const allFakerSpecs: readonly FakerSpec[] = [
  ...personSpecs,
  ...internetSpecs,
  ...addressSpecs,
  ...companySpecs,
  ...commerceSpecs,
  ...financeSpecs,
  ...datetimeSpecs,
  ...textSpecs,
  ...idSpecs,
  ...brazilSpecs,
];
