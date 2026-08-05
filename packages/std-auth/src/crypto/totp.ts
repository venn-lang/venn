import { type ActionContext, type Bytes, fromHex } from "@venn-lang/sdk";
import { hmacHex } from "./hmac.js";

/** What {@link totpCode} needs. Not exported: only the verb behind it calls this. */
interface TotpArgs {
  /** The action context, which holds the bound engine. */
  ctx: ActionContext;
  /** The shared seed. */
  seed: string;
  /** The instant to compute for, in seconds. Fixing it fixes the code. */
  at?: number;
  /** The step, in seconds. */
  period?: number;
  /** How many digits the code has. */
  digits?: number;
}

/**
 * An RFC 6238 TOTP code: SHA-1, a 30 second period and 6 digits by default.
 *
 * @param args See {@link TotpArgs}.
 * @returns The zero-padded code.
 */
export async function totpCode(args: TotpArgs): Promise<string> {
  const counter = Math.floor((args.at ?? 0) / (args.period ?? 30));
  const mac = await hmacHex({
    ctx: args.ctx,
    secret: args.seed,
    payload: counterBytes(counter),
    algorithm: "sha1",
  });
  return truncate({ mac: fromHex(mac), digits: args.digits ?? 6 });
}

/**
 * 8-byte big-endian counter, per HOTP (RFC 4226).
 *
 * Signed as bytes and never as text: byte `0x80` is not a character, so a counter
 * handed over as a string is re-encoded into something longer and the code that
 * comes out matches no authenticator. That is why the engine's `hmac` takes both.
 */
function counterBytes(counter: number): Bytes {
  const buffer = new Uint8Array(8) as Bytes;
  let remaining = counter;
  for (let i = 7; i >= 0; i -= 1) {
    buffer[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return buffer;
}

/** Dynamic truncation of an HMAC into a zero-padded decimal code (RFC 4226 §5.3). */
function truncate(args: { mac: Uint8Array; digits: number }): string {
  const mac = args.mac;
  const offset = byteAt(mac, mac.length - 1) & 0x0f;
  const binary =
    ((byteAt(mac, offset) & 0x7f) << 24) |
    (byteAt(mac, offset + 1) << 16) |
    (byteAt(mac, offset + 2) << 8) |
    byteAt(mac, offset + 3);
  return String(binary % 10 ** args.digits).padStart(args.digits, "0");
}

function byteAt(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? 0;
}
