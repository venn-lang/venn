import { hmacRaw } from "./hmac.js";

/**
 * An RFC 6238 TOTP code: SHA-1, a 30 second period and 6 digits by default.
 *
 * @param args.at The instant to compute for, in seconds. Fixing it fixes the code.
 */
export async function totpCode(args: {
  seed: string;
  at?: number;
  period?: number;
  digits?: number;
}): Promise<string> {
  const period = args.period ?? 30;
  const digits = args.digits ?? 6;
  const counter = Math.floor((args.at ?? 0) / period);
  const mac = await hmacRaw({ secret: args.seed, message: counterBytes(counter), algo: "sha1" });
  return truncate({ mac, digits });
}

/** 8-byte big-endian counter, per HOTP (RFC 4226). */
function counterBytes(counter: number): Uint8Array<ArrayBuffer> {
  const buffer = new Uint8Array(8);
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
