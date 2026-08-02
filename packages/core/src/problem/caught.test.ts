import { describe, expect, it } from "vitest";
import { buildProblem, CODES } from "../codes/index.js";
import { caughtValue, isFailure } from "./caught.js";
import { ProblemError } from "./problem-error.js";

const SPAN = { uri: "orders.vn", offset: 0, length: 3, line: 12, column: 5 };

/**
 * A `VennError` as this reads one: by its fields.
 *
 * Written out rather than constructed, because what is being checked is that
 * anything arriving with these fields is understood. The class lives in
 * `contracts`, which the kernel takes types from and never values.
 */
function carrying(fields: { code: string; message: string; detail?: unknown }) {
  return fields;
}

function raised(over: Partial<Parameters<typeof buildProblem>[0]> = {}): ProblemError {
  return new ProblemError({
    ...buildProblem({ spec: CODES.VN3013_NOT_CALLABLE, span: SPAN, title: "It blew up.", ...over }),
    help: "Try the other one.",
    docs: "https://venn-lang.dev/errors/VN3013",
  });
}

/**
 * A failure as a value.
 *
 * It was two fields built by a three-line function. Everything else the failure
 * knew, where it happened, what would help, what the docs say, was rendered to a
 * terminal and thrown away before the program that caught it could see any of it.
 */
describe("what a catch is handed", () => {
  it("takes the code from inside the problem, where it lives", () => {
    expect(caughtValue(raised()).code).toBe("VN3013");
  });

  it("takes the code off the error when it carries its own", () => {
    const failure = carrying({ code: "pay.declined", message: "The card said no." });

    expect(caughtValue(failure)).toMatchObject({
      code: "pay.declined",
      message: "The card said no.",
    });
  });

  it("says where it happened, as a report reads it", () => {
    expect(caughtValue(raised()).where).toBe("orders.vn:12:5");
  });

  it("carries the help and the docs the failure was raised with", () => {
    expect(caughtValue(raised())).toMatchObject({
      help: "Try the other one.",
      docs: "https://venn-lang.dev/errors/VN3013",
    });
  });

  it("carries what a fail attached", () => {
    const failure = carrying({
      code: "cart.empty",
      message: "Nothing to pay for.",
      detail: { data: { items: 0 } },
    });

    expect(caughtValue(failure).data).toEqual({ items: 0 });
  });

  /** One nothing, so a program can ask `e.help == null` and be answered. */
  it("says nothing rather than undefined for what was not carried", () => {
    const bare = caughtValue(new Error("from below the language"));

    expect(bare).toEqual({
      code: "VN7000",
      message: "from below the language",
      where: null,
      help: null,
      docs: null,
      data: null,
    });
  });
});

/**
 * Redaction happens at the producer: a secret yields its marker whenever it is
 * serialised. Nothing here unwraps anything, so a secret that reached a failure
 * is still a secret when a program reads it back out of one.
 */
describe("a secret that reached a failure", () => {
  it("is still redacted where the program reads it", () => {
    const secret = {
      reveal: () => "hunter2",
      toString: () => "‹redacted›",
      toJSON: () => "‹redacted›",
    };
    const failure = carrying({
      code: "auth.rejected",
      message: "Rejected.",
      detail: { data: { token: secret } },
    });

    const held = caughtValue(failure).data as { token: unknown };

    expect(String(held.token)).toBe("‹redacted›");
    expect(JSON.stringify(held)).toBe('{"token":"‹redacted›"}');
  });
});

describe("what is not a failure", () => {
  it("is anything that is not an error, which is how a signal passes through", () => {
    expect(isFailure(new Error("boom"))).toBe(true);
    expect(isFailure(raised())).toBe(true);
    expect(isFailure({ kind: "break" })).toBe(false);
  });
});
