import { t } from "@venn-lang/types";
import type { Rng } from "../rng/index.js";
import { eanDigit } from "./check-digits.js";
import { ADJECTIVES, CATEGORIES, COLORS, MATERIALS, PRODUCTS } from "./data/index.js";
import type { FakerSpec } from "./faker.types.js";
import { capitalize, chars, digits, floatBetween, pick } from "./primitives.js";

function productName(rng: Rng): string {
  const adjective = capitalize(pick(ADJECTIVES, rng));
  return `${adjective} ${pick(MATERIALS, rng)} ${pick(PRODUCTS, rng)}`;
}

function sku(rng: Rng): string {
  const letters = chars({ count: 3, alphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ", rng });
  return `${letters}-${digits(5, rng)}`;
}

/** A 13-digit EAN with a real check digit, so barcode validators accept it. */
function barcode(rng: Rng): string {
  const base = digits(12, rng);
  return `${base}${eanDigit(base)}`;
}

export const commerceSpecs: readonly FakerSpec[] = [
  {
    name: "product",
    doc: "A product noun.",
    result: t.string,
    make: (rng) => pick(PRODUCTS, rng),
  },
  { name: "productName", doc: "A full product name.", result: t.string, make: productName },
  { name: "sku", doc: "A stock keeping unit.", result: t.string, make: sku },
  { name: "barcode", doc: "A valid EAN-13 barcode.", result: t.string, make: barcode },
  {
    name: "category",
    doc: "A product category.",
    result: t.string,
    make: (rng) => pick(CATEGORIES, rng),
  },
  {
    name: "material",
    doc: "A material, like `leather`.",
    result: t.string,
    make: (rng) => pick(MATERIALS, rng),
  },
  { name: "color", doc: "A colour name.", result: t.string, make: (rng) => pick(COLORS, rng)[0] },
  {
    name: "hexColor",
    doc: "A colour as a hex triplet, like `#1e88e5`.",
    result: t.string,
    make: (rng) => pick(COLORS, rng)[1],
  },
  {
    name: "price",
    doc: "A retail price with two decimal places.",
    result: t.number,
    make: (rng) => floatBetween({ min: 5, max: 500, decimals: 2, rng }),
  },
];
