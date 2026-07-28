import { t } from "@venn-lang/types";
import type { Rng } from "../rng/index.js";
import { CITIES, COUNTRIES, NOUNS, STREET_TYPES, TIMEZONES } from "./data/index.js";
import type { FakerSpec } from "./faker.types.js";
import { capitalize, digits, floatBetween, intBetween, pick } from "./primitives.js";

function street(rng: Rng): string {
  return `${capitalize(pick(NOUNS, rng))} ${pick(STREET_TYPES, rng)}`;
}

function streetAddress(rng: Rng): string {
  return `${intBetween({ min: 1, max: 9999, rng })} ${street(rng)}`;
}

function country(rng: Rng): string {
  return pick(COUNTRIES, rng)[0];
}

function countryCode(rng: Rng): string {
  return pick(COUNTRIES, rng)[1];
}

/** A one-line postal address, the shape a shipping form expects. */
function address(rng: Rng): string {
  return `${streetAddress(rng)}, ${pick(CITIES, rng)} ${digits(5, rng)}, ${country(rng)}`;
}

export const addressSpecs: readonly FakerSpec[] = [
  { name: "street", doc: "A street name.", result: t.string, make: street },
  {
    name: "streetAddress",
    doc: "A street name with a building number.",
    result: t.string,
    make: streetAddress,
  },
  { name: "address", doc: "A full one-line postal address.", result: t.string, make: address },
  {
    name: "buildingNumber",
    doc: "A building number.",
    result: t.number,
    make: (rng) => intBetween({ min: 1, max: 9999, rng }),
  },
  { name: "city", doc: "A city name.", result: t.string, make: (rng) => pick(CITIES, rng) },
  { name: "country", doc: "A country name.", result: t.string, make: country },
  { name: "countryCode", doc: "An ISO 3166-1 alpha-2 code.", result: t.string, make: countryCode },
  {
    name: "zip",
    doc: "A five-digit postal code.",
    result: t.string,
    make: (rng) => digits(5, rng),
  },
  {
    name: "latitude",
    doc: "A latitude in degrees, between -90 and 90.",
    result: t.number,
    make: (rng) => floatBetween({ min: -90, max: 90, decimals: 6, rng }),
  },
  {
    name: "longitude",
    doc: "A longitude in degrees, between -180 and 180.",
    result: t.number,
    make: (rng) => floatBetween({ min: -180, max: 180, decimals: 6, rng }),
  },
  {
    name: "timezone",
    doc: "An IANA time zone name.",
    result: t.string,
    make: (rng) => pick(TIMEZONES, rng),
  },
];
