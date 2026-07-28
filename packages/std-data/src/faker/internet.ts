import { t } from "@venn-lang/types";
import type { Rng } from "../rng/index.js";
import {
  ADJECTIVES,
  HTTP_METHODS,
  HTTP_STATUSES,
  MIME_TYPES,
  NOUNS,
  PROTOCOLS,
  SAFE_DOMAINS,
  TLDS,
  USER_AGENTS,
} from "./data/index.js";
import type { FakerSpec } from "./faker.types.js";
import { firstName, lastName } from "./person.js";
import { ALNUM, chars, digits, HEX, intBetween, pick, slug } from "./primitives.js";

/** An email on a reserved domain, e.g. `"grace.hopper@example.test"`. It reaches nobody. */
export function email(rng: Rng): string {
  const local = `${slug(firstName(rng))}.${slug(lastName(rng))}`;
  return `${local}@${pick(SAFE_DOMAINS, rng)}`;
}

function username(rng: Rng): string {
  return `${slug(firstName(rng))}${intBetween({ min: 1, max: 99, rng })}`;
}

function password(rng: Rng): string {
  return chars({ count: 14, alphabet: `${ALNUM}!@#$%&*?`, rng });
}

function domain(rng: Rng): string {
  return `${pick(ADJECTIVES, rng)}${pick(NOUNS, rng)}.${pick(TLDS, rng)}`;
}

function url(rng: Rng): string {
  return `${pick(PROTOCOLS, rng)}://${domain(rng)}/${pick(NOUNS, rng)}`;
}

function ipv4(rng: Rng): string {
  const octet = (): number => intBetween({ min: 1, max: 254, rng });
  return `${octet()}.${octet()}.${octet()}.${octet()}`;
}

function ipv6(rng: Rng): string {
  const group = (): string => chars({ count: 4, alphabet: HEX, rng });
  return Array.from({ length: 8 }, group).join(":");
}

function mac(rng: Rng): string {
  const pair = (): string => chars({ count: 2, alphabet: HEX, rng }).toUpperCase();
  return Array.from({ length: 6 }, pair).join(":");
}

export const internetSpecs: readonly FakerSpec[] = [
  { name: "email", doc: "An email address on a reserved domain.", result: t.string, make: email },
  { name: "username", doc: "A login name.", result: t.string, make: username },
  { name: "password", doc: "A 14-character password.", result: t.string, make: password },
  { name: "domain", doc: "A domain name.", result: t.string, make: domain },
  { name: "url", doc: "An absolute URL.", result: t.string, make: url },
  { name: "ipv4", doc: "An IPv4 address.", result: t.string, make: ipv4 },
  { name: "ipv6", doc: "An IPv6 address.", result: t.string, make: ipv6 },
  { name: "mac", doc: "A MAC address.", result: t.string, make: mac },
  {
    name: "port",
    doc: "An unprivileged TCP port.",
    result: t.number,
    make: (rng) => intBetween({ min: 1024, max: 65535, rng }),
  },
  {
    name: "userAgent",
    doc: "A browser User-Agent string.",
    result: t.string,
    make: (rng) => pick(USER_AGENTS, rng),
  },
  {
    name: "slug",
    doc: "A URL slug, like `bright-harbour-417`.",
    result: t.string,
    make: (rng) => `${pick(ADJECTIVES, rng)}-${pick(NOUNS, rng)}-${digits(3, rng)}`,
  },
  {
    name: "httpMethod",
    doc: "An HTTP verb.",
    result: t.string,
    make: (rng) => pick(HTTP_METHODS, rng),
  },
  {
    name: "httpStatus",
    doc: "An HTTP status code that servers really return.",
    result: t.number,
    make: (rng) => pick(HTTP_STATUSES, rng),
  },
  {
    name: "mimeType",
    doc: "A MIME type.",
    result: t.string,
    make: (rng) => pick(MIME_TYPES, rng),
  },
];
