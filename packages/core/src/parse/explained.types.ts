/**
 * What an explainer answers with: the line to print, and where to point it when
 * that is not where the parser itself stopped.
 *
 * Recovery lands on the token the parser could not go past, which is often a
 * word or two away from the one that was actually refused, so an explainer that
 * knows better says so.
 */
export interface Explained {
  readonly title: string;
  readonly offset?: number;
}
