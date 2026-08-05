import { describe, expect, it } from "vitest";
import { didYouMean, didYouMeanQuoted } from "./did-you-mean.js";

/** The sentence with whatever quotes it carries taken back off. */
const bare = (said: string): string => said.replaceAll(/["`]/g, "");

/**
 * Two renderings of one sentence, and nothing else that differs.
 *
 * The offer is an instruction to substitute, so the quoting is part of the
 * instruction. A verb is typed bare, and a code span around it is the whole of
 * what to do. A package path is only ever written between quotes, so offering
 * `venn/io` bare offers a line that does not parse: `import { io } from venn/io`
 * earns VN1002 rather than running.
 *
 * The last row is the one that matters. Two checkers asking one question have to
 * ask it in one set of words, and the only licence either has to differ is the
 * quoting a reader substitutes into.
 */
describe("the offer of a name", () => {
  it("backticks a name the reader types bare", () => {
    expect(didYouMean("io.readLine")).toBe("Did you mean `io.readLine`?");
  });

  it("quotes a name the reader types between quotes", () => {
    expect(didYouMeanQuoted("venn/io")).toBe('Did you mean "venn/io"?');
  });

  it("says the same words either way, so only the quoting differs", () => {
    expect(bare(didYouMean("venn/io"))).toBe(bare(didYouMeanQuoted("venn/io")));
    expect(bare(didYouMean("io.readLine"))).toBe("Did you mean io.readLine?");
  });

  /** A name with nothing in it would make both sentences quote an empty pair. */
  it("offers whatever it was handed, since deciding there is an answer is not its job", () => {
    expect(didYouMean("a")).toBe("Did you mean `a`?");
    expect(didYouMeanQuoted("a")).toBe('Did you mean "a"?');
  });
});
