import { buildProblem, CODES } from "../../../codes/index.js";
import type { DecoDecl } from "../../../generated/ast.js";
import type { Problem } from "../../../problem/index.js";
import { namesBound } from "./names-bound.js";
import { namesRead } from "./names-read.js";
import type { NameRead } from "./reach.types.js";

/**
 * Every name a `deco` body reaches for and cannot have, refused where it is
 * written.
 *
 * A decorator runs before the program exists: the file's own `const`s have no
 * value yet and its functions are not callable, so a body that reads one gets
 * nothing. Until this, nothing said so. The name evaluated to nothing, an
 * interpolation printed empty, and a call on it surfaced later as a message
 * from the machine with no code and no line.
 *
 * @param args The `deco` and the file it was written in.
 * @returns One problem per name written out of reach, each at its own span.
 */
export function namesOutOfReach(args: { decl: DecoDecl; uri: string }): Problem[] {
  const inReach = namesBound(args.decl);
  const reads = namesRead({ body: args.decl.body, uri: args.uri });
  return reads.filter((read) => !inReach.has(read.name)).map(refuse);
}

function refuse(read: NameRead): Problem {
  return buildProblem({
    spec: CODES.VN2023_OUT_OF_REACH,
    span: read.span,
    title: `\`${read.name}\` is out of reach here: a decorator runs before the program exists.`,
    help: HELP,
  });
}

const HELP =
  "A `deco` body reads its own parameters, its own `const`s and the prelude. Nothing at the top of the file has a value yet.";
