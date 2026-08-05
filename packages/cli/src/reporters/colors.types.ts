/** The little of an output stream that decides whether it may carry escapes. */
export interface Stream {
  isTTY?: boolean;
}

/**
 * One style, applied to text for the stream it is about to be written to.
 *
 * The stream is the argument because a command writes to two of them: the
 * report goes to standard output and a problem to standard error, and only one
 * of those is a terminal when the other is redirected to a file.
 */
export type Style = (text: string, stream?: Stream) => string;
