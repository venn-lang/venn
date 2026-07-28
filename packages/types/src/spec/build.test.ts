import { describe, expect, it } from "vitest";
import { t } from "./build.js";

describe("t", () => {
  it("builds the signature of a verb that takes a handler", () => {
    const spec = t.fn(
      [t.opaque("http.Server"), t.callback([t.ref("http.Request")], t.ref("http.Reply"), 1)],
      t.void,
    );

    expect(spec).toEqual({
      kind: "fn",
      params: [
        { kind: "opaque", name: "http.Server" },
        {
          kind: "fn",
          params: [{ kind: "ref", name: "http.Request" }],
          result: { kind: "ref", name: "http.Reply" },
          takes: 1,
        },
      ],
      result: { kind: "prim", name: "void" },
    });
  });

  // The whole point of plain data: what a plugin writes and what a generator
  // emits have to be the same bytes, or the two roads diverge.
  it("survives a round trip through JSON", () => {
    const spec = t.record(
      {
        method: t.union(t.literal("GET"), t.literal("POST")),
        url: t.string,
        headers: t.map(t.string),
        trailers: t.list(t.string),
      },
      { optional: ["trailers"], open: false },
    );

    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
  });

  it("keeps `takes` off a plain function, so arity means what it says", () => {
    expect(t.fn([t.string], t.number)).not.toHaveProperty("takes");
    expect(t.callback([t.string], t.number, 1).takes).toBe(1);
  });
});
