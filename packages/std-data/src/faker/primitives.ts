import { VennError } from "@venn-lang/contracts";
import { PLUGIN_CODES } from "@venn-lang/sdk";
import type { Rng } from "../rng/index.js";

const COMBINING = /[\u0300-\u036f]/g;

export const DIGITS = "0123456789";
export const HEX = "0123456789abcdef";
export const LOWER = "abcdefghijklmnopqrstuvwxyz";
export const ALNUM: string = `${LOWER}${LOWER.toUpperCase()}${DIGITS}`;

/** Pick one item from a list. Drawing from an empty list is a programming error. */
export function pick<T>(items: readonly T[], rng: Rng): T {
  const chosen = items[Math.floor(rng() * items.length)];
  if (chosen === undefined) {
    throw new VennError({
      code: PLUGIN_CODES.VN7005_BAD_ARGUMENT,
      message: "There is nothing to pick from.",
    });
  }
  return chosen;
}

/** An integer in the inclusive range [min, max]. */
export function intBetween(args: { min: number; max: number; rng: Rng }): number {
  return args.min + Math.floor(args.rng() * (args.max - args.min + 1));
}

/** A number in [min, max), rounded to `decimals` places. */
export function floatBetween(args: {
  min: number;
  max: number;
  decimals: number;
  rng: Rng;
}): number {
  const raw = args.min + args.rng() * (args.max - args.min);
  return Number(raw.toFixed(args.decimals));
}

/** `count` characters drawn from `alphabet`. */
export function chars(args: { count: number; alphabet: string; rng: Rng }): string {
  let out = "";
  for (let index = 0; index < args.count; index += 1) {
    out += args.alphabet.charAt(Math.floor(args.rng() * args.alphabet.length));
  }
  return out;
}

/** `count` decimal digits, e.g. `"40721"`. */
export function digits(count: number, rng: Rng): string {
  return chars({ count, alphabet: DIGITS, rng });
}

/** Upper-case the first character, leaving the rest alone. */
export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Zero-pad a number to `width` digits. */
export function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** Strip diacritics so a name can become an email local part or a URL slug. */
export function ascii(text: string): string {
  return text.normalize("NFD").replace(COMBINING, "");
}

/** ASCII-safe lowercase slug: `"João Gonçalves"` → `"joao-goncalves"`. */
export function slug(text: string): string {
  const plain = ascii(text).toLowerCase();
  return plain.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Read a positional argument as a number, falling back when it is absent. */
export function numArg(args: readonly unknown[], index: number, fallback: number): number {
  const raw = Number(args[index]);
  return args[index] === undefined || Number.isNaN(raw) ? fallback : raw;
}

/** Build `count` values, each drawn independently. */
export function times<T>(count: number, make: () => T): T[] {
  return Array.from({ length: count }, make);
}
