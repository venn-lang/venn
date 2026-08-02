import net from "node:net";
import { afterAll, expect, it } from "vitest";
import { createFetchClient } from "./fetch-client.js";
import { asRequestError } from "./fetch-failure.js";

const attempt = { method: "GET", url: "https://api.test/health", elapsedMs: 12 };

/** A loopback port nothing is listening on: bound to get one, then given back. */
async function closedPort(): Promise<number> {
  const socket = net.createServer();
  await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = (socket.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  return port;
}

/** A server that accepts and never answers, so a request can run out of time. */
const silent = net.createServer(() => {});
afterAll(() => {
  silent.close();
});

async function silentPort(): Promise<number> {
  if (!silent.listening) {
    await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
  }
  return (silent.address() as net.AddressInfo).port;
}

async function failureOf(url: string, signal?: AbortSignal): Promise<Error & { code?: string }> {
  try {
    await createFetchClient().request({ method: "GET", url, signal });
  } catch (error) {
    return error as Error & { code?: string };
  }
  throw new Error(`expected ${url} to fail`);
}

it("a real refused connection is VN7022 naming the address", async () => {
  const port = await closedPort();
  const error = await failureOf(`http://127.0.0.1:${port}/health`);
  expect(error.code).toBe("VN7022");
  expect(error.message).toBe(
    `Nothing is listening on 127.0.0.1:${port}, so GET http://127.0.0.1:${port}/health was refused.`,
  );
});

it("a port no client will open is VN7022, and says so", async () => {
  const error = await failureOf("http://127.0.0.1:1/health");
  expect(error.code).toBe("VN7022");
  expect(error.message).toBe(
    "Port 1 is one no HTTP client will open, so GET http://127.0.0.1:1/health never went out.",
  );
});

it("a request that runs out of time is VN7024", async () => {
  const port = await silentPort();
  const error = await failureOf(`http://127.0.0.1:${port}/slow`, AbortSignal.timeout(50));
  expect(error.code).toBe("VN7024");
  expect(error.message).toMatch(
    /^GET http:\/\/127\.0\.0\.1:\d+\/slow ran out of time after \d+ms without an answer\.$/,
  );
});

it("a name that does not resolve is VN7023", () => {
  // The shape Node hands back for a DNS failure, one level down on `cause`.
  const cause = Object.assign(new Error("getaddrinfo ENOTFOUND api.test"), { code: "ENOTFOUND" });
  const error = asRequestError({
    attempt,
    error: new TypeError("fetch failed", { cause }),
  }) as Error & { code?: string };
  expect(error.code).toBe("VN7023");
  expect(error.message).toBe(
    "The name api.test did not resolve, so GET https://api.test/health had nowhere to go.",
  );
});

it("a resolver that could not answer at all is still VN7023", () => {
  const cause = Object.assign(new Error("getaddrinfo EAI_AGAIN api.test"), { code: "EAI_AGAIN" });
  const error = asRequestError({ attempt, error: new TypeError("fetch failed", { cause }) });
  expect((error as { code?: string }).code).toBe("VN7023");
});

it("a host with two addresses refuses once per address and is still VN7022", () => {
  // Node reports both attempts as one AggregateError, which carries the code
  // itself when the attempts agree.
  const cause = Object.assign(new AggregateError([], ""), { code: "ECONNREFUSED" });
  const error = asRequestError({ attempt, error: new TypeError("fetch failed", { cause }) });
  expect((error as { code?: string }).code).toBe("VN7022");
});

it("a cancelled request is not dressed up as a failure of its own", () => {
  const aborted = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
  expect(asRequestError({ attempt, error: aborted })).toBe(aborted);
});
