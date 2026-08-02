import { describe, expect, it } from "vitest";
import { targetOf } from "./target-of.js";

/**
 * What a failure names when it says nothing was listening.
 *
 * The authority is the part a person can act on: the host they can ping and the
 * port they can check. A message that named only the scheme, or nothing at all,
 * would leave them exactly where they started.
 */
describe("the address a request was aimed at", () => {
  it("takes the port that was written", () => {
    expect(targetOf("http://127.0.0.1:8080/health")).toEqual({
      authority: "127.0.0.1:8080",
      host: "127.0.0.1",
      port: "8080",
    });
  });

  it("fills in the port the scheme implies, since nobody writes it", () => {
    expect(targetOf("https://example.com/health").authority).toBe("example.com:443");
    expect(targetOf("http://example.com/health").authority).toBe("example.com:80");
  });

  /**
   * A URL that will not parse is its own authority. A failure naming the text
   * somebody actually wrote is more use than one naming nothing, and this is the
   * path a typo takes.
   */
  it("hands back what it was given when that is not a URL", () => {
    expect(targetOf("not a url at all")).toEqual({
      authority: "not a url at all",
      host: "not a url at all",
      port: "",
    });
  });

  it("leaves the port empty for a scheme it has no default for", () => {
    expect(targetOf("ftp://example.com/x")).toEqual({
      authority: "example.com",
      host: "example.com",
      port: "",
    });
  });
});
