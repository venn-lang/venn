import { type ActionDefinition, arg, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { fromHex, toHex } from "../bytes/index.js";
import { CryptoEnginePort, type HashAlgorithm } from "../port/index.js";

const algorithm = z.enum(["sha1", "sha256", "sha384", "sha512"]).default("sha256");
const hashParams = z.object({ algorithm }).optional();
const hmacParams = z.object({ key: z.string(), algorithm });
const bytesParams = z.object({ size: z.number().int().positive().default(16) }).optional();

/** The `crypto.hash`, `crypto.hmac`, `crypto.randomBytes` and `crypto.uuid` verbs. */
export const hashActions: ActionDefinition[] = [
  defineAction({
    name: "hash",
    doc: "Digest a string, hex-encoded. Defaults to sha256.",
    params: hashParams,
    args: [arg("data", t.string, "What to digest.")],
    result: t.string,
    run: (ctx, input) =>
      ctx.port(CryptoEnginePort).digest({
        algorithm: algorithmOf(input.params),
        data: String(input.args[0] ?? ""),
      }),
  }),
  defineAction({
    name: "hmac",
    doc: "Keyed digest of a string, hex-encoded.",
    params: hmacParams,
    args: [arg("data", t.string, "What to sign. The key goes in the options.")],
    result: t.string,
    run: (ctx, input) => {
      const params = input.params as { key: string; algorithm: HashAlgorithm };
      const data = String(input.args[0] ?? "");
      return ctx
        .port(CryptoEnginePort)
        .hmac({ algorithm: params.algorithm, key: params.key, data });
    },
  }),
  defineAction({
    name: "randomBytes",
    doc: "Random bytes, hex-encoded.",
    params: bytesParams,
    // `size` is an option, so the verb takes nothing positionally.
    result: t.string,
    run: (ctx, input) => {
      const size = (input.params as { size?: number } | undefined)?.size ?? 16;
      return ctx.port(CryptoEnginePort).randomBytes(size);
    },
  }),
  defineAction({
    name: "uuid",
    doc: "A random UUID v4.",
    result: t.string,
    run: (ctx) => uuidFrom(ctx.port(CryptoEnginePort).randomBytes(16)),
  }),
];

function algorithmOf(params: unknown): HashAlgorithm {
  return (params as { algorithm?: HashAlgorithm } | undefined)?.algorithm ?? "sha256";
}

// Stamp the version and variant bits, then group as 8-4-4-4-12.
function uuidFrom(hex: string): string {
  const bytes = fromHex(hex);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const text = toHex(bytes);
  const groups = [text.slice(0, 8), text.slice(8, 12), text.slice(12, 16), text.slice(16, 20)];
  return [...groups, text.slice(20, 32)].join("-");
}
