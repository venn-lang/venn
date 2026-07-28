/** The exact location of a problem in a source file (1-based line/column). */
export interface Span {
  uri: string;
  offset: number;
  length: number;
  line: number;
  column: number;
}
