/**
 * Compare two strings in time that does not depend on where they differ.
 *
 * Use this for every signature and digest check: `===` returns early on the
 * first mismatched byte, which leaks the correct prefix to a patient attacker.
 *
 * @param left One digest, signature or token.
 * @param right The other.
 * @returns Whether they are the same string.
 */
export function equals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}
