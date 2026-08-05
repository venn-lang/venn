import { describe, expect, it } from "vitest";
import { fromBase64, toBase64, toBytes } from "./index.js";

/**
 * Base64 arrives from whoever sent it, so reading it must cost what its length
 * costs and no more.
 *
 * `/=+$/` is the obvious way to drop the padding and it backtracks: the engine
 * retries the run of `=` at every position, so a payload of many `=` followed by
 * anything at all costs time in the square of its length. Measured on the
 * spelling this replaced, two hundred thousand `=` and one `x` took 18.9
 * seconds, which is a denial of service reachable from `crypto.base64.decode`
 * of a request body.
 */
describe("padding on a payload nobody vouched for", () => {
  it("costs what the payload's length costs, not its square", () => {
    const hostile = `${"=".repeat(200_000)}x`;
    const started = Date.now();

    expect(() => fromBase64(hostile)).toThrow();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("still drops the padding it is there to drop", () => {
    expect(fromBase64(toBase64(toBytes("a")))).toEqual(toBytes("a"));
    expect(fromBase64(toBase64(toBytes("ab")))).toEqual(toBytes("ab"));
    expect(fromBase64(toBase64(toBytes("abc")))).toEqual(toBytes("abc"));
  });

  /** A `=` inside the digits is not padding, and is refused as the digit it is not. */
  it("refuses a padding character that is not at the end", () => {
    expect(() => fromBase64("YQ=E")).toThrow();
  });
});
