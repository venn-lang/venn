import {
  type ActionContext,
  type ActionDefinition,
  arg,
  CryptoEnginePort,
  defineAction,
  equals,
  fromHex,
  JWS_ALGORITHMS,
  JWS_HASH,
  jwsHash,
  toBase64Url,
  toBytes,
  z,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { decodeJwt } from "../jwt/index.js";

const signParams = z.object({
  payload: z.record(z.string(), z.unknown()),
  secret: z.string(),
  algorithm: z.enum(JWS_ALGORITHMS).default("HS256"),
});
const verifyParams = z.object({ secret: z.string() });

/** The `crypto.jwt.*` verbs: read a token, mint one, check one. */
export const jwtActions: ActionDefinition[] = [
  defineAction({
    name: "jwt.decode",
    doc: "Take a token apart without verifying it: header, payload, signature.",
    args: [arg("token", t.string, "The token to take apart. Nothing is verified.")],
    result: t.ref("crypto.Jwt"),
    run: (_ctx, input) => decodeJwt(String(input.args[0] ?? "")),
  }),
  defineAction({
    name: "jwt.sign",
    doc: "Mint an HMAC-signed token.",
    params: signParams,
    // Payload, secret and algorithm are all options, so nothing goes positionally.
    result: t.string,
    run: (ctx, input) => sign(ctx, input.params as z.infer<typeof signParams>),
  }),
  defineAction({
    name: "jwt.verify",
    doc: "True when the token's signature matches the secret.",
    params: verifyParams,
    args: [arg("token", t.string, "The token to check against the secret in the options.")],
    result: t.bool,
    run: (ctx, input) =>
      verify(ctx, String(input.args[0] ?? ""), input.params as { secret: string }),
  }),
];

async function sign(ctx: ActionContext, params: z.infer<typeof signParams>): Promise<string> {
  const header = { alg: params.algorithm, typ: "JWT" };
  const input = `${encode(header)}.${encode(params.payload)}`;
  const mac = await ctx.port(CryptoEnginePort).hmac({
    algorithm: JWS_HASH[params.algorithm],
    key: params.secret,
    data: input,
  });
  return `${input}.${toBase64Url(fromHex(mac))}`;
}

async function verify(
  ctx: ActionContext,
  token: string,
  params: { secret: string },
): Promise<boolean> {
  const decoded = decodeJwt(token);
  const algorithm = jwsHash(String(decoded.header.alg ?? ""));
  if (!algorithm) return false;
  const mac = await ctx.port(CryptoEnginePort).hmac({
    algorithm,
    key: params.secret,
    data: decoded.signingInput,
  });
  return equals(toBase64Url(fromHex(mac)), decoded.signature);
}

function encode(value: unknown): string {
  return toBase64Url(toBytes(JSON.stringify(value)));
}
