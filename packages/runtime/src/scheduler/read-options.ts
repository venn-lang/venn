import { buildProblem, CODES, evaluate, type MapLit, ProblemError } from "@venn-lang/core";
import type { ParamSpec } from "@venn-lang/sdk";
import { CONSTRUCT_OPTIONS } from "./construct-options.js";
import { nodeSpan } from "./node-span.js";
import { outsideItsDomain } from "./option-domain.js";
import type { ReadOptions } from "./read-options.types.js";
import { settle } from "./settled.js";
import { strayKeyTitle } from "./unknown-option.js";

/**
 * Read a construct's options as a value, refusing what its declaration does not
 * allow.
 *
 * The whole map is evaluated rather than each key hunted for by name, so a
 * `{ ...defaults }` poured in contributes what it holds. Read key by key, a
 * spread had no written key to match and was dropped in silence, which is the
 * one shape that cannot be spotted by reading the call site.
 *
 * @param args The written map, whose construct it is, and where to read it.
 * @returns The options, every one of them known and within its domain.
 * @throws ProblemError `VN3001` for a key nobody declared, `VN3010` for a value
 * the declaration does not allow.
 */
export async function readOptions(args: ReadOptions): Promise<Record<string, unknown>> {
  const specs = CONSTRUCT_OPTIONS[args.kind] ?? [];
  if (!args.opts) return {};
  const raw = (await settle(evaluate(args.opts, args.scope))) as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) refuse({ args, specs, key, value });
  return raw;
}

interface Refusal {
  args: ReadOptions;
  specs: readonly ParamSpec[];
  key: string;
  value: unknown;
}

function refuse(refusal: Refusal): void {
  const spec = refusal.specs.find((one) => one.name === refusal.key);
  const wrong = spec
    ? outsideItsDomain(spec, refusal.value)
    : strayKeyTitle(refusal.key, refusal.specs);
  if (!wrong) return;
  const code = spec ? CODES.VN3010_TYPE_MISMATCH : CODES.VN3001_UNKNOWN_OPTION;
  throw new ProblemError(buildProblem({ spec: code, span: whereWritten(refusal), title: wrong }));
}

/**
 * The entry that carries the key, or the map itself when the key arrived by
 * spread and so is written nowhere the reader could point at.
 */
function whereWritten(refusal: Refusal): ReturnType<typeof nodeSpan> {
  const written = refusal.args.opts?.entries.find((entry) => entry.key === refusal.key);
  return nodeSpan(written ?? (refusal.args.opts as MapLit), refusal.args.uri);
}
