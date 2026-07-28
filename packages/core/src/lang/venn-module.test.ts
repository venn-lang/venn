import { describe, expect, it } from "vitest";
import { createVennServices } from "./venn-module.js";

/**
 * The grammar check that production mode keeps out of startup.
 *
 * Chevrotain validates the generated parser rules against each other in
 * development mode only, and throws when they disagree: ambiguous
 * alternatives, an unreachable rule, a token defined twice. Running it here
 * costs one test instead of milliseconds in every process that parses a `.vn`.
 */
describe("the generated grammar", () => {
  it("passes Chevrotain's own validation", () => {
    const services = createVennServices("development");

    expect(() => services.parser.LangiumParser.parse("print 1\n")).not.toThrow();
  });

  it("ships without that validation, so startup does not pay for it", () => {
    expect(createVennServices().LanguageMetaData.mode).toBe("production");
  });
});
