/**
 * One line beneath a problem's title: what it answers, and the answer.
 *
 * The label is the question in a word, not a heading a renderer invented, so a
 * terminal can pad it, an editor can drop it, and a UI can put it in a column.
 */
export interface ProblemLine {
  label: "at" | "help" | "note" | "see" | "docs";
  text: string;
}
