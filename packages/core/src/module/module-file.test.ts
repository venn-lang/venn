import { describe, expect, it } from "vitest";
import { moduleFileOf } from "./module-file.js";

/**
 * An extension means a file. No extension means a folder.
 *
 * No cascade, so there is no resolution order to learn or to get wrong: whoever
 * reads the import knows from the string alone which of the two it points at.
 */
describe("where a specifier leads", () => {
  it("takes a written extension as the file itself", () => {
    expect(moduleFileOf("./cart.vn")).toBe("./cart.vn");
    expect(moduleFileOf("../shared/text.vn")).toBe("../shared/text.vn");
  });

  it("reads one without an extension as a folder's face", () => {
    expect(moduleFileOf("./cart")).toBe("./cart/mod.vn");
    expect(moduleFileOf("../shared")).toBe("../shared/mod.vn");
  });

  it("does the same through an alias", () => {
    expect(moduleFileOf("#lib/cart")).toBe("#lib/cart/mod.vn");
    expect(moduleFileOf("#lib/cart.vn")).toBe("#lib/cart.vn");
  });

  /** A package is nobody's file: what it publishes is its own business. */
  it("leaves a package alone", () => {
    expect(moduleFileOf("venn/http")).toBe("venn/http");
    expect(moduleFileOf("@acme/stripe")).toBe("@acme/stripe");
  });

  it("reads a folder written with a slash after it as the same folder", () => {
    expect(moduleFileOf("./cart/")).toBe("./cart/mod.vn");
  });

  /** Nothing is tried and then something else: one string, one answer. */
  it("never answers with two places", () => {
    for (const spec of ["./cart", "./cart.vn", "#lib/cart", "venn/http"]) {
      expect(moduleFileOf(moduleFileOf(spec))).toBe(moduleFileOf(spec));
    }
  });
});
