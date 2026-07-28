import { expect } from "vitest";

/**
 * Asserts that an async operation rejects with a `VennError` whose `.code`
 * matches.
 *
 * Suites assert on the code and never on the message, so wording can be
 * improved without breaking a conformance run.
 *
 * @param args.op - the operation expected to reject.
 * @param args.code - pattern the error code must match, e.g. `/^VN8/`.
 */
export async function expectVennError(args: {
  op: () => Promise<unknown>;
  code: RegExp;
}): Promise<void> {
  await expect(args.op()).rejects.toMatchObject({ code: expect.stringMatching(args.code) });
}
