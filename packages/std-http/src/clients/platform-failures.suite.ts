/**
 * What Node's `fetch` really rejects with, so the conformance suite can drive
 * the real client through all three failures without a network.
 *
 * The shapes are copied from what Node 24 produces, not invented: `TypeError:
 * fetch failed` on top, and the reason one level down on `cause`. A test in
 * `fetch-failure.test.ts` fails a real loopback connection to keep this file
 * honest about the two cases loopback can reproduce.
 */

import type { HttpFailure } from "../port/index.js";

const CAUSES: Readonly<Record<HttpFailure, () => Error>> = {
  refused: () =>
    Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:59991"), {
      code: "ECONNREFUSED",
      errno: -4078,
      syscall: "connect",
      address: "127.0.0.1",
      port: 59991,
    }),
  "not-found": () =>
    Object.assign(new Error("getaddrinfo ENOTFOUND does-not-exist.invalid"), {
      code: "ENOTFOUND",
      errno: -3008,
      syscall: "getaddrinfo",
      hostname: "does-not-exist.invalid",
    }),
  timeout: () =>
    Object.assign(
      new Error("Connect Timeout Error (attempted address: 10.255.255.1:80, timeout: 10000ms)"),
      { code: "UND_ERR_CONNECT_TIMEOUT", name: "ConnectTimeoutError" },
    ),
};

/**
 * The rejection `fetch` hands back for one of the three failures.
 *
 * @param failure Which failure to reproduce.
 * @returns The `TypeError` to throw, with the reason on its `cause`.
 */
export function fetchRejection(failure: HttpFailure): TypeError {
  return new TypeError("fetch failed", { cause: CAUSES[failure]() });
}
