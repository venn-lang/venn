import { t } from "@venn/types";
import type { Rng } from "../rng/index.js";
import { cnpjDigits, cpfDigits } from "./brazil-documents.js";
import { BR_CITIES, BR_STATES, BR_STREET_NAMES, BR_STREET_TYPES } from "./data/index.js";
import type { FakerSpec } from "./faker.types.js";
import { chars, digits, intBetween, pick } from "./primitives.js";

/** A CPF with correct check digits, formatted `000.000.000-00`. */
function cpf(rng: Rng): string {
  const base = digits(9, rng);
  const full = `${base}${cpfDigits(base)}`;
  return `${full.slice(0, 3)}.${full.slice(3, 6)}.${full.slice(6, 9)}-${full.slice(9)}`;
}

/** A CNPJ with correct check digits, formatted `00.000.000/0001-00`. */
function cnpj(rng: Rng): string {
  const base = `${digits(8, rng)}0001`;
  const full = `${base}${cnpjDigits(base)}`;
  return `${full.slice(0, 2)}.${full.slice(2, 5)}.${full.slice(5, 8)}/${full.slice(8, 12)}-${full.slice(12)}`;
}

function cep(rng: Rng): string {
  return `${digits(5, rng)}-${digits(3, rng)}`;
}

/** A mobile number, `(11) 9XXXX-XXXX`. */
function phone(rng: Rng): string {
  const area = intBetween({ min: 11, max: 99, rng });
  return `(${area}) 9${digits(4, rng)}-${digits(4, rng)}`;
}

/** A Mercosul plate, `ABC1D23`. */
function plate(rng: Rng): string {
  const letters = (count: number): string =>
    chars({ count, alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", rng });
  return `${letters(3)}${digits(1, rng)}${letters(1)}${digits(2, rng)}`;
}

function street(rng: Rng): string {
  return `${pick(BR_STREET_TYPES, rng)} ${pick(BR_STREET_NAMES, rng)}`;
}

function address(rng: Rng): string {
  const state = pick(BR_STATES, rng)[1];
  const number = intBetween({ min: 1, max: 4000, rng });
  return `${street(rng)}, ${number} — ${pick(BR_CITIES, rng)}/${state}, ${cep(rng)}`;
}

export const brazilSpecs: readonly FakerSpec[] = [
  { name: "br.cpf", doc: "A CPF with valid check digits.", result: t.string, make: cpf },
  { name: "br.cnpj", doc: "A CNPJ with valid check digits.", result: t.string, make: cnpj },
  { name: "br.cep", doc: "A postal code as `00000-000`.", result: t.string, make: cep },
  { name: "br.phone", doc: "A Brazilian mobile number.", result: t.string, make: phone },
  { name: "br.plate", doc: "A Mercosul licence plate.", result: t.string, make: plate },
  { name: "br.street", doc: "A Brazilian street name.", result: t.string, make: street },
  { name: "br.address", doc: "A full Brazilian address.", result: t.string, make: address },
  {
    name: "br.city",
    doc: "A Brazilian city.",
    result: t.string,
    make: (rng) => pick(BR_CITIES, rng),
  },
  {
    name: "br.state",
    doc: "A Brazilian federal unit, by name.",
    result: t.string,
    make: (rng) => pick(BR_STATES, rng)[0],
  },
  {
    name: "br.stateCode",
    doc: "A Brazilian federal unit, by two-letter code.",
    result: t.string,
    make: (rng) => pick(BR_STATES, rng)[1],
  },
];
