import type { Style } from "./colors.types.js";

// Colour only when a human is watching: never when piped, and never against
// NO_COLOR (https://no-color.org) or a dumb terminal.
const ESC = String.fromCharCode(27);

/**
 * The question is asked per call and per stream, never once at import.
 *
 * Per stream because a command writes to two of them: `venn check` sends its
 * report to standard output and its problems to standard error, and `2>err.txt`
 * leaves only one of them a terminal. Per call because a decision taken while
 * the module loads is one no test can change afterwards, which is why nothing
 * covered this.
 */
function style(open: number, close: number): Style {
  return (text, stream = process.stdout) => {
    const colour = Boolean(stream.isTTY) && !process.env.NO_COLOR && process.env.TERM !== "dumb";
    return colour ? `${ESC}[${open}m${text}${ESC}[${close}m` : text;
  };
}

export const bold: Style = style(1, 22);
export const dim: Style = style(2, 22);
export const red: Style = style(31, 39);
export const green: Style = style(32, 39);
export const yellow: Style = style(33, 39);
export const cyan: Style = style(36, 39);
export const inverse: Style = style(7, 27);
