/** Milliseconds, at a precision that stays readable from microseconds to seconds. */
export function ms(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

/** How many times faster the quicker side is: `312×`. */
export function times(ratio: number): string {
  return `${ratio >= 100 ? ratio.toFixed(0) : ratio.toFixed(1)}×`;
}

/** Venn's speed as a share of TypeScript's: `0.32%`. */
export function share(ratio: number): string {
  const percent = 100 / ratio;
  return `${percent >= 1 ? percent.toFixed(1) : percent.toFixed(2)}%`;
}
