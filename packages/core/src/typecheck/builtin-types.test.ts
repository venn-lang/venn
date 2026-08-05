import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { BUILTIN_TYPES } from "./builtin-types.js";
import { checkTypes } from "./check-types.js";
import { showType } from "./show.js";
import type { Type } from "./type.types.js";

/** What the checker made of `x` in `fn f(x: <written>) => x`. */
function annotated(written: string): string | undefined {
  const checked = checkTypes(parse(`fn f(x: ${written}) => x`).ast);
  for (const [node, type] of checked.types) {
    const decl = node as { name?: string; $type?: string };
    if (decl.$type === "Param" && decl.name === "x") return showType(type as Type);
  }
  return undefined;
}

/**
 * The table the editor offers is the table the checker honours.
 *
 * `never` sat in it and nowhere else, so `const a: never = 5` checked clean: an
 * annotation naming a type nothing declares falls back to `dynamic`, which
 * accepts everything. A built-in the checker has never heard of is worse than an
 * absent one, because the completion list is what tells a reader it exists.
 */
describe("every built-in type the editor offers", () => {
  for (const name of Object.keys(BUILTIN_TYPES)) {
    // `dynamic` is the fallback itself, so it is the one name allowed to be it.
    if (name === "dynamic") continue;
    it(`resolves \`${name}\` to a type rather than to dynamic`, () => {
      expect(annotated(name)).not.toBe("dynamic");
    });
  }

  /** The other half of the check: it is capable of failing. */
  it("would have caught `never`, which nothing declares", () => {
    expect(annotated("never")).toBe("dynamic");
  });
});
