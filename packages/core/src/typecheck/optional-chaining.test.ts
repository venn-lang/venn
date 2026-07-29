import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return its error codes and titles. */
function check(source: string): string[] {
  const { ast } = parse(source);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

const SHAPES = `type Address { city: string }
type User { name: string, address: Address }
const user: User = { name: "a", address: { city: "b" } }
`;

describe("asking with ?. about a shape the checker knows", () => {
  /**
   * The case this was opened for. Refusing the question made the operator
   * useless exactly where the shape is known, which is the only place it could
   * have helped: it passed only when the receiver's type was open.
   */
  it("accepts a field the shape does not carry", () => {
    expect(check(`${SHAPES}\nprint user.address?.postcode`)).toEqual([]);
  });

  it("still rejects the same field asserted with a plain dot", () => {
    const errors = check(`${SHAPES}\nprint user.address.postcode`);

    expect(errors[0]).toContain("VN3010");
    expect(errors[0]).toContain("postcode");
  });

  /**
   * Asking about a field that is there must not throw away what it holds, or
   * `?.` would quietly turn every value it touches into `dynamic`.
   */
  it("keeps the type of a field that is there", () => {
    const source = `${SHAPES}
fn takesNumber(n: number) -> number => n
print takesNumber(user?.name)`;

    const errors = check(source);

    expect(errors[0]).toContain("VN3010");
    expect(errors[0]).toContain("string");
  });

  it("accepts a member a closed kind does not carry", () => {
    expect(check(`const s = "text"\nprint s?.nope`)).toEqual([]);
  });

  it("still rejects that member asserted with a plain dot", () => {
    const errors = check(`const s = "text"\nprint s.nope`);

    expect(errors[0]).toContain("VN3010");
    expect(errors[0]).toContain("nope");
  });

  it("keeps a member a closed kind does carry", () => {
    expect(check(`const s = "text"\nconst n: number = s?.length`)).toEqual([]);
  });

  it("says nothing either way when the receiver's type is open", () => {
    expect(check("fn f(x) => x?.whatever\nprint f(1)")).toEqual([]);
  });

  it("chains, and the answer stays askable", () => {
    expect(check(`${SHAPES}\nprint user?.address?.postcode?.deep`)).toEqual([]);
  });
});
