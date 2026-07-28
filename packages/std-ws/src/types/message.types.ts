/**
 * One message on the socket, and what `ws.expect` hands back.
 *
 * Both fields are optional because a peer is free to send whatever it likes;
 * `where` queries match on fields beyond these two.
 */
export interface Message {
  type?: string;
  data?: unknown;
}
