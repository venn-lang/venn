import { t } from "@venn/types";
import type { Rng } from "../rng/index.js";
import {
  FIRST_NAMES,
  GENDERS,
  JOB_TITLES,
  LAST_NAMES,
  NAME_PREFIXES,
  NAME_SUFFIXES,
} from "./data/index.js";
import type { FakerSpec } from "./faker.types.js";
import { digits, intBetween, pad, pick } from "./primitives.js";

/** A given name, e.g. `"Grace"`. */
export function firstName(rng: Rng): string {
  return pick(FIRST_NAMES, rng);
}

/** A family name, e.g. `"Hopper"`. */
export function lastName(rng: Rng): string {
  return pick(LAST_NAMES, rng);
}

/** A full name, e.g. `"Grace Hopper"`. */
export function fullName(rng: Rng): string {
  return `${firstName(rng)} ${lastName(rng)}`;
}

function birthDate(rng: Rng): string {
  const year = intBetween({ min: 1950, max: 2006, rng });
  const month = intBetween({ min: 1, max: 12, rng });
  const day = intBetween({ min: 1, max: 28, rng });
  return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** `+1 555 01xx`, the range reserved for fiction, so it can never reach anyone. */
function phone(rng: Rng): string {
  return `+1 555 01${digits(2, rng)}`;
}

export const personSpecs: readonly FakerSpec[] = [
  { name: "firstName", doc: "A given name.", result: t.string, make: firstName },
  { name: "lastName", doc: "A family name.", result: t.string, make: lastName },
  { name: "name", doc: "A full name.", result: t.string, make: fullName },
  { name: "fullName", doc: "A full name.", result: t.string, make: fullName },
  {
    name: "prefix",
    doc: "An honorific that precedes a name, like `Dra.`.",
    result: t.string,
    make: (rng) => pick(NAME_PREFIXES, rng),
  },
  {
    name: "suffix",
    doc: "A generational suffix that follows a name, like `Neto`.",
    result: t.string,
    make: (rng) => pick(NAME_SUFFIXES, rng),
  },
  {
    name: "gender",
    doc: "A gender value shaped the way most forms model them.",
    result: t.string,
    make: (rng) => pick(GENDERS, rng),
  },
  {
    name: "jobTitle",
    doc: "A job title, like `Site Reliability Engineer`.",
    result: t.string,
    make: (rng) => pick(JOB_TITLES, rng),
  },
  {
    name: "age",
    doc: "An adult age, between 18 and 80.",
    result: t.number,
    make: (rng) => intBetween({ min: 18, max: 80, rng }),
  },
  {
    name: "birthDate",
    doc: "A birth date as `YYYY-MM-DD`.",
    result: t.string,
    make: birthDate,
  },
  {
    name: "phone",
    doc: "An international phone number in the range reserved for fiction.",
    result: t.string,
    make: phone,
  },
];
