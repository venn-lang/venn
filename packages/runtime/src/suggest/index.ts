/**
 * What the user probably meant.
 *
 * Its own module rather than a file inside `check/`, because the checker and
 * the scheduler both suggest names and `check/` already reaches into
 * `scheduler/`. A copy in each is what the two ended up with, and how they came
 * to disagree about the same typo.
 */

export { nearestName } from "./nearest-name.js";
