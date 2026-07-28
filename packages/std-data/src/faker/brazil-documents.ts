// Check digits for Brazilian documents. A CPF or CNPJ with the wrong digits is
// refused by the form before the request leaves the browser, so getting them
// right is what makes a generated document usable in a real test.

/**
 * The two CPF check digits.
 *
 * @param base The first nine digits, unformatted.
 * @returns Two digits to append.
 */
export function cpfDigits(base: string): string {
  const first = cpfDigit(base, 10);
  return `${first}${cpfDigit(`${base}${first}`, 11)}`;
}

function cpfDigit(base: string, weight: number): string {
  let sum = 0;
  for (let index = 0; index < base.length; index += 1) {
    sum += Number(base[index]) * (weight - index);
  }
  const rest = (sum * 10) % 11;
  return String(rest === 10 ? 0 : rest);
}

const CNPJ_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * The two CNPJ check digits.
 *
 * @param base The first twelve digits, unformatted.
 * @returns Two digits to append.
 */
export function cnpjDigits(base: string): string {
  const first = cnpjDigit(base);
  return `${first}${cnpjDigit(`${base}${first}`)}`;
}

function cnpjDigit(base: string): string {
  const weights = CNPJ_WEIGHTS.slice(CNPJ_WEIGHTS.length - base.length);
  let sum = 0;
  for (let index = 0; index < base.length; index += 1) {
    sum += Number(base[index]) * (weights[index] ?? 0);
  }
  const rest = sum % 11;
  return String(rest < 2 ? 0 : 11 - rest);
}
