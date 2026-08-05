/**
 * What the user probably meant.
 *
 * Its own module rather than a file inside a checker, because five checkers and
 * the type inference all suggest names. A copy in each is what two of them once
 * had, and how they came to disagree about the same typo.
 *
 * In `core` rather than in `runtime`, because the type checker is the sixth
 * caller and `core` may not import `runtime`. There is no re-export left behind:
 * one symbol, one path.
 */

export { didYouMean, didYouMeanQuoted } from "./did-you-mean.js";
export { nearestName } from "./nearest-name.js";
