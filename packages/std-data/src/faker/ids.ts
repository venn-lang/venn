import { optionalArg } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import type { Rng } from "../rng/index.js";
import type { FakerSpec } from "./faker.types.js";
import { ALNUM, chars, digits, floatBetween, HEX, intBetween, numArg } from "./primitives.js";

/** An RFC 4122 v4 UUID. The version and variant bits are stamped, not drawn. */
export function uuid(rng: Rng): string {
  const hex = (count: number): string => chars({ count, alphabet: HEX, rng });
  const variant = "89ab".charAt(Math.floor(rng() * 4));
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

const NANO_ALPHABET = `${ALNUM}_-`;

export const idSpecs: readonly FakerSpec[] = [
  { name: "uuid", doc: "A v4 UUID.", result: t.string, make: uuid },
  {
    name: "nanoid",
    doc: "A 21-character NanoID. `faker.nanoid(10)` sets the length.",
    result: t.string,
    args: [optionalArg("length", t.number, "How many characters. 21 by default.")],
    make: (rng, args) => chars({ count: numArg(args, 0, 21), alphabet: NANO_ALPHABET, rng }),
  },
  {
    name: "objectId",
    doc: "A 24-character MongoDB ObjectId.",
    result: t.string,
    make: (rng) => chars({ count: 24, alphabet: HEX, rng }),
  },
  {
    name: "hex",
    doc: "Hex characters. `faker.hex(32)` sets how many.",
    result: t.string,
    args: [optionalArg("length", t.number, "How many characters.")],
    make: (rng, args) => chars({ count: numArg(args, 0, 16), alphabet: HEX, rng }),
  },
  {
    name: "token",
    doc: "A 32-character opaque token.",
    result: t.string,
    make: (rng) => chars({ count: 32, alphabet: ALNUM, rng }),
  },
  {
    name: "alphanumeric",
    doc: "Letters and digits. `faker.alphanumeric(8)` sets how many.",
    result: t.string,
    args: [optionalArg("length", t.number, "How many characters.")],
    make: (rng, args) => chars({ count: numArg(args, 0, 8), alphabet: ALNUM, rng }),
  },
  {
    name: "digits",
    doc: "Decimal digits. `faker.digits(6)` sets how many.",
    result: t.string,
    args: [optionalArg("length", t.number, "How many digits.")],
    make: (rng, args) => digits(numArg(args, 0, 6), rng),
  },
  {
    name: "int",
    doc: "An integer. `faker.int(1, 10)` bounds it, inclusive.",
    result: t.number,
    args: [
      optionalArg("min", t.number, "The lowest it may be, included."),
      optionalArg("max", t.number, "The highest it may be, included."),
    ],
    make: (rng, args) => intBetween({ min: numArg(args, 0, 0), max: numArg(args, 1, 100), rng }),
  },
  {
    name: "float",
    doc: "A number with two decimals. `faker.float(0, 1)` bounds it.",
    result: t.number,
    args: [
      optionalArg("min", t.number, "The lowest it may be."),
      optionalArg("max", t.number, "The highest it may be."),
    ],
    make: (rng, args) =>
      floatBetween({ min: numArg(args, 0, 0), max: numArg(args, 1, 1), decimals: 2, rng }),
  },
  { name: "boolean", doc: "`true` or `false`.", result: t.bool, make: (rng) => rng() < 0.5 },
];
