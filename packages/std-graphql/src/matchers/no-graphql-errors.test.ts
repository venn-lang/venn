import { describe, expect, it } from "vitest";
import { noGraphqlErrors } from "./no-graphql-errors.js";

function run(subject: unknown): boolean {
  return noGraphqlErrors.test({ subject, args: [], params: {} }) as boolean;
}

describe("noGraphqlErrors", () => {
  it("passes when errors are absent", () => {
    expect(run({ data: { me: { id: "u1" } } })).toBe(true);
  });

  it("passes when errors is an empty array", () => {
    expect(run({ data: {}, errors: [] })).toBe(true);
  });

  it("fails when errors are present", () => {
    expect(run({ data: null, errors: [{ message: "boom" }] })).toBe(false);
  });
});
