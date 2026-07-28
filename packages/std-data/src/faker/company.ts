import { t } from "@venn-lang/types";
import type { Rng } from "../rng/index.js";
import {
  BUZZWORDS,
  CATCH_VERBS,
  COMPANY_ROOTS,
  COMPANY_SUFFIXES,
  DEPARTMENTS,
} from "./data/index.js";
import type { FakerSpec } from "./faker.types.js";
import { capitalize, pick } from "./primitives.js";

function company(rng: Rng): string {
  return `${pick(COMPANY_ROOTS, rng)} ${pick(COMPANY_SUFFIXES, rng)}`;
}

function catchPhrase(rng: Rng): string {
  return `${capitalize(pick(CATCH_VERBS, rng))} your ${pick(BUZZWORDS, rng)}`;
}

export const companySpecs: readonly FakerSpec[] = [
  { name: "company", doc: "A company name.", result: t.string, make: company },
  {
    name: "department",
    doc: "A department name.",
    result: t.string,
    make: (rng) => pick(DEPARTMENTS, rng),
  },
  {
    name: "catchPhrase",
    doc: "A marketing catch phrase.",
    result: t.string,
    make: catchPhrase,
  },
  {
    name: "buzzword",
    doc: "A single piece of business jargon.",
    result: t.string,
    make: (rng) => pick(BUZZWORDS, rng),
  },
];
