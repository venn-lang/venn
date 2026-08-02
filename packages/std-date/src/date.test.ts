import { createVirtualClock } from "@venn-lang/contracts";
import type { ActionContext } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { datePlugin } from "./plugin.js";

const actions = datePlugin.actions ?? [];
const AT = "2026-07-23T12:00:00Z";

/** A moment, as the language holds one. */
function moment(iso: string): unknown {
  return { kind: "instant", epochMs: Date.parse(iso), iso };
}

/** Run one verb, with a clock a test decides the time of. */
function run(name: string, ...args: unknown[]): unknown {
  const found = actions.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`date.${name} is not a verb`);
  const clock = createVirtualClock({ start: Date.parse(AT) });
  const ctx = { port: () => clock } as unknown as ActionContext;
  return found.run(ctx, { args, params: {} });
}

describe("building a moment", () => {
  /** The clock is the run's, so a test decides what time it is. */
  it("asks the run's clock what now is", () => {
    expect(run("now")).toEqual(expect.objectContaining({ epochMs: Date.parse(AT) }));
  });

  it("builds one from its parts, counting months from one", () => {
    const built = run("of", { year: 2026, month: 2, day: 1 }) as { iso: string };

    expect(built.iso).toBe("2026-02-01T00:00:00.000Z");
  });

  it("takes the smallest it can be for anything left out", () => {
    const built = run("of", { year: 2026 }) as { iso: string };

    expect(built.iso).toBe("2026-01-01T00:00:00.000Z");
  });

  it("reads one from text", () => {
    expect(run("parse", AT)).toEqual(expect.objectContaining({ epochMs: Date.parse(AT) }));
  });

  /** Text that is not a date is the everyday case, not a surprise. */
  it("answers with nothing when the text is not one", () => {
    expect(run("parse", "not a date")).toBeNull();
    expect(run("parse", "")).toBeNull();
  });
});

describe("writing one out", () => {
  it("fills in the tokens and leaves the rest as it was written", () => {
    expect(run("format", moment(AT), "YYYY-MM-DD HH:mm:ss")).toBe("2026-07-23 12:00:00");
    expect(run("format", moment(AT), "on YYYY at HH")).toBe("on 2026 at 12");
  });

  it("has a short spelling for the parts that do not need padding", () => {
    expect(run("format", moment("2026-02-03T04:05:06Z"), "D/M/YY H")).toBe("3/2/26 4");
  });

  /** The whole point: the same moment reads differently where people are. */
  it("writes it where somebody stands, not where the machine is", () => {
    expect(run("format", moment(AT), "HH:mm", "America/Sao_Paulo")).toBe("09:00");
    expect(run("format", moment(AT), "HH:mm", "Asia/Tokyo")).toBe("21:00");
    expect(run("format", moment(AT), "HH:mm")).toBe("12:00");
  });

  it("refuses a zone that is not one, the way `in` does", () => {
    expect(() => run("format", moment(AT), "HH", "Mars/Olympus")).toThrow(/no timezone called/);
  });
});

describe("reading one where somebody stands", () => {
  it("gives the parts in that zone", () => {
    expect(run("in", moment(AT), "Asia/Tokyo")).toEqual({
      year: 2026,
      month: 7,
      day: 23,
      hour: 21,
      minute: 0,
      second: 0,
    });
  });

  /** Nine hours on is the next day, which is what a timezone is for. */
  it("crosses the day where the zone does", () => {
    expect(run("in", moment("2026-07-23T20:00:00Z"), "Asia/Tokyo")).toEqual(
      expect.objectContaining({ day: 24, hour: 5 }),
    );
  });

  /**
   * A name that is not a timezone is a mistake in the program, not data being
   * ordinary, so the run ends at it. It answered with nothing while `format`
   * refused the same name, which is two verbs disagreeing about one thing.
   */
  it("refuses a zone nobody has heard of, the way `format` does", () => {
    expect(() => run("in", moment(AT), "Nowhere/Fictional")).toThrow(/no timezone called/);
  });
});

describe("what the namespace publishes", () => {
  it("types every verb", () => {
    expect(actions.filter((action) => !action.signature).map((one) => one.name)).toEqual([]);
  });

  /** What a moment answers about itself is a member, and stays one. */
  it("leaves to the moment what the moment already answers", () => {
    const names = new Set(actions.map((action) => action.name));

    for (const member of ["year", "plus", "minus", "until", "isBefore"]) {
      expect(names.has(member), member).toBe(false);
    }
  });
});
