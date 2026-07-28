// biome-ignore-all lint/suspicious/noTemplateCurlyInString: ${name} is a placeholder in a dotenv path, not a JavaScript template.
import { describe, expect, it } from "vitest";
import { parseDotenv } from "./parse-dotenv.js";

describe("parseDotenv", () => {
  it("reads a name and its value", () => {
    expect(parseDotenv("BASE=http://localhost\nTOKEN=abc")).toEqual({
      BASE: "http://localhost",
      TOKEN: "abc",
    });
  });

  it("skips comments and blank lines", () => {
    expect(parseDotenv("# a note\n\nBASE=x\n")).toEqual({ BASE: "x" });
  });

  it("accepts the `export` a shell file carries", () => {
    expect(parseDotenv("export BASE=x")).toEqual({ BASE: "x" });
  });

  it("keeps what quotes were put there to keep", () => {
    expect(parseDotenv('GREETING="hello world"')).toEqual({ GREETING: "hello world" });
    expect(parseDotenv("PATTERN='a # b'")).toEqual({ PATTERN: "a # b" });
  });

  it("drops a trailing comment from an unquoted value", () => {
    expect(parseDotenv("BASE=x # why")).toEqual({ BASE: "x" });
  });

  // Venn interpolates in its own strings; two syntaxes meaning two things is
  // how people get surprised.
  it("leaves a placeholder alone rather than expanding it", () => {
    expect(parseDotenv("URL=${BASE}/users")).toEqual({ URL: "${BASE}/users" });
  });
});
