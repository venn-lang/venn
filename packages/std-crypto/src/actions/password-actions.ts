import {
  type ActionContext,
  type ActionDefinition,
  arg,
  CryptoEnginePort,
  defineAction,
  equals,
  type HashAlgorithm,
  z,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

const SCHEME = "pbkdf2";
const DEFAULT_ITERATIONS = 100_000;

const hashParams = z
  .object({
    iterations: z.number().int().positive().default(DEFAULT_ITERATIONS),
    algorithm: z.enum(["sha256", "sha512"]).default("sha256"),
  })
  .optional();
const verifyParams = z.object({ hash: z.string() });

/**
 * The `crypto.password.hash` and `crypto.password.verify` verbs.
 *
 * PBKDF2 rather than bcrypt, because WebCrypto offers PBKDF2 and so the package
 * needs no native module. The encoded form carries its own cost parameters,
 * `pbkdf2$sha256$iterations$salt$derived`, so a stored hash stays verifiable
 * after the defaults here change.
 */
export const passwordActions: ActionDefinition[] = [
  defineAction({
    name: "password.hash",
    doc: "Hash a password with PBKDF2, returning a self-describing string.",
    params: hashParams,
    args: [arg("password", t.string, "The password in the clear.")],
    result: t.string,
    run: (ctx, input) => hash(ctx, String(input.args[0] ?? ""), input.params),
  }),
  defineAction({
    name: "password.verify",
    doc: "True when the password matches a hash produced by `password.hash`.",
    params: verifyParams,
    args: [arg("password", t.string, "The password in the clear, to check against the hash.")],
    result: t.bool,
    run: (ctx, input) =>
      verify(ctx, String(input.args[0] ?? ""), (input.params as { hash: string }).hash),
  }),
];

async function hash(ctx: ActionContext, password: string, params: unknown): Promise<string> {
  const options = (params ?? {}) as { iterations?: number; algorithm?: HashAlgorithm };
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const algorithm = options.algorithm ?? "sha256";
  const salt = ctx.port(CryptoEnginePort).randomBytes(16);
  const derived = await ctx
    .port(CryptoEnginePort)
    .derive({ password, salt, iterations, algorithm });
  return [SCHEME, algorithm, iterations, salt, derived].join("$");
}

async function verify(ctx: ActionContext, password: string, encoded: string): Promise<boolean> {
  const [scheme, algorithm, iterations, salt, derived] = encoded.split("$");
  if (scheme !== SCHEME || !algorithm || !salt || !derived) return false;
  const again = await ctx.port(CryptoEnginePort).derive({
    password,
    salt,
    iterations: Number(iterations),
    algorithm: algorithm as HashAlgorithm,
  });
  return equals(again, derived);
}
