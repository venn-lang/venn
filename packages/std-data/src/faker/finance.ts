import { t } from "@venn/types";
import type { Rng } from "../rng/index.js";
import { ibanCheck, luhnDigit } from "./check-digits.js";
import { CARD_BRANDS, CURRENCIES } from "./data/index.js";
import type { FakerSpec } from "./faker.types.js";
import { chars, digits, floatBetween, intBetween, pad, pick } from "./primitives.js";

/** A 16-digit card number that passes Luhn, grouped `#### #### #### ####`. */
function creditCard(rng: Rng): string {
  const [, prefix, length] = pick(CARD_BRANDS, rng);
  const base = `${prefix}${digits(length - prefix.length - 1, rng)}`;
  const full = `${base}${luhnDigit(base)}`;
  return (full.match(/.{1,4}/g) ?? []).join(" ");
}

function expiryDate(rng: Rng): string {
  const month = intBetween({ min: 1, max: 12, rng });
  return `${pad(month, 2)}/${intBetween({ min: 26, max: 34, rng })}`;
}

/** An IBAN with correct mod-97 check digits. */
function iban(rng: Rng): string {
  const country = "DE";
  const account = digits(18, rng);
  return `${country}${ibanCheck(country, account)}${account}`;
}

function bic(rng: Rng): string {
  const letters = (count: number): string =>
    chars({ count, alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", rng });
  return `${letters(4)}${letters(2)}${letters(2)}`;
}

export const financeSpecs: readonly FakerSpec[] = [
  {
    name: "creditCard",
    doc: "A 16-digit card number that passes the Luhn check.",
    result: t.string,
    make: creditCard,
  },
  {
    name: "cardType",
    doc: "A card brand, like `Visa`.",
    result: t.string,
    make: (rng) => pick(CARD_BRANDS, rng)[0],
  },
  {
    name: "cvv",
    doc: "A three-digit card security code.",
    result: t.string,
    make: (rng) => digits(3, rng),
  },
  { name: "expiryDate", doc: "A card expiry as `MM/YY`.", result: t.string, make: expiryDate },
  { name: "iban", doc: "An IBAN with valid check digits.", result: t.string, make: iban },
  { name: "bic", doc: "A SWIFT/BIC code.", result: t.string, make: bic },
  {
    name: "accountNumber",
    doc: "A bank account number.",
    result: t.string,
    make: (rng) => digits(10, rng),
  },
  {
    name: "currencyCode",
    doc: "An ISO 4217 currency code, like `BRL`.",
    result: t.string,
    make: (rng) => pick(CURRENCIES, rng)[0],
  },
  {
    name: "currencySymbol",
    doc: "A currency symbol, like `R$`.",
    result: t.string,
    make: (rng) => pick(CURRENCIES, rng)[1],
  },
  {
    name: "currencyName",
    doc: "A currency name, like `Brazilian Real`.",
    result: t.string,
    make: (rng) => pick(CURRENCIES, rng)[2],
  },
  {
    name: "amount",
    doc: "A monetary amount with two decimal places.",
    result: t.number,
    make: (rng) => floatBetween({ min: 1, max: 10000, decimals: 2, rng }),
  },
];
