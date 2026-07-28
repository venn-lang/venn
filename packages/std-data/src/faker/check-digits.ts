import { pad } from "./primitives.js";

// Check digits for the numbers real forms validate locally. A card, barcode or
// IBAN with the wrong digit is rejected before any network call, so a generator
// that skips these produces values no checkout would ever accept.

/**
 * The Luhn check digit for a card number.
 *
 * @param base The digits preceding the check digit.
 * @returns One digit. Appending it makes `base` pass the Luhn test.
 */
export function luhnDigit(base: string): string {
  let sum = 0;
  let double = true;
  for (let index = base.length - 1; index >= 0; index -= 1) {
    const scaled = Number(base[index]) * (double ? 2 : 1);
    sum += scaled > 9 ? scaled - 9 : scaled;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * The EAN-13 check digit for the leading 12 digits of a barcode.
 *
 * @param base Exactly 12 digits.
 * @returns The thirteenth digit.
 */
export function eanDigit(base: string): string {
  let sum = 0;
  for (let index = 0; index < base.length; index += 1) {
    sum += Number(base[index]) * (index % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * The two IBAN check digits: mod-97 over the rearranged, letter-expanded account.
 *
 * @param country The two-letter country code, upper case.
 * @param account The account part, without check digits.
 * @returns Two digits, zero-padded, to be inserted after the country code.
 */
export function ibanCheck(country: string, account: string): string {
  const rearranged = `${account}${country}00`;
  const expanded = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  return pad(98 - mod97(expanded), 2);
}

/** Mod 97 digit by digit, because an expanded IBAN overflows `Number`. */
function mod97(value: string): number {
  let rest = 0;
  for (const char of value) rest = (rest * 10 + Number(char)) % 97;
  return rest;
}
