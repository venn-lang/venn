import { optionalArg } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import type { Rng } from "../rng/index.js";
import { ADJECTIVES, LOREM, NOUNS } from "./data/index.js";
import type { FakerSpec } from "./faker.types.js";
import { capitalize, intBetween, numArg, pick, times } from "./primitives.js";

function words(rng: Rng, count: number): string {
  return times(count, () => pick(LOREM, rng)).join(" ");
}

/** A capitalised sentence of 6 to 14 words, ending in a full stop. */
function sentence(rng: Rng): string {
  return `${capitalize(words(rng, intBetween({ min: 6, max: 14, rng })))}.`;
}

function sentences(rng: Rng, count: number): string {
  return times(count, () => sentence(rng)).join(" ");
}

function paragraph(rng: Rng): string {
  return sentences(rng, intBetween({ min: 3, max: 6, rng }));
}

/** A headline in title case, e.g. `"Bright Harbour"`. */
function title(rng: Rng): string {
  return `${capitalize(pick(ADJECTIVES, rng))} ${capitalize(pick(NOUNS, rng))}`;
}

export const textSpecs: readonly FakerSpec[] = [
  { name: "word", doc: "A single word.", result: t.string, make: (rng) => pick(LOREM, rng) },
  {
    name: "words",
    doc: "Several words. `faker.words(5)` sets how many.",
    result: t.string,
    args: [optionalArg("count", t.number, "How many words.")],
    make: (rng, args) => words(rng, numArg(args, 0, 3)),
  },
  { name: "sentence", doc: "One sentence.", result: t.string, make: sentence },
  {
    name: "sentences",
    doc: "Several sentences. `faker.sentences(3)` sets how many.",
    result: t.string,
    args: [optionalArg("count", t.number, "How many sentences.")],
    make: (rng, args) => sentences(rng, numArg(args, 0, 3)),
  },
  { name: "paragraph", doc: "One paragraph.", result: t.string, make: paragraph },
  {
    name: "paragraphs",
    doc: "Several paragraphs, separated by blank lines. `faker.paragraphs(4)` sets how many.",
    result: t.string,
    args: [optionalArg("count", t.number, "How many paragraphs.")],
    make: (rng, args) => times(numArg(args, 0, 2), () => paragraph(rng)).join("\n\n"),
  },
  { name: "title", doc: "A short headline in title case.", result: t.string, make: title },
];
