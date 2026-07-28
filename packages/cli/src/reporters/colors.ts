// Colour only when a human is watching: never when piped, and never against
// NO_COLOR (https://no-color.org) or a dumb terminal.
const ESC = String.fromCharCode(27);
const ENABLED =
  Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== "dumb";

function style(open: number, close: number): (text: string) => string {
  return (text) => (ENABLED ? `${ESC}[${open}m${text}${ESC}[${close}m` : text);
}

export const bold: (text: string) => string = style(1, 22);
export const dim: (text: string) => string = style(2, 22);
export const red: (text: string) => string = style(31, 39);
export const green: (text: string) => string = style(32, 39);
export const yellow: (text: string) => string = style(33, 39);
export const cyan: (text: string) => string = style(36, 39);
export const inverse: (text: string) => string = style(7, 27);
