import { createTestHost } from "@venn-lang/contracts";
import type { Envelope, Problem, RunId } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { problemStream } from "./problem-stream.js";
import type { ProblemStream } from "./problem-stream.types.js";

const PROBLEM: Problem = {
  code: "VN2014",
  severity: "error",
  title: "@timeout decorates a flow, a step or a group, and this is a parallel.",
  span: { uri: "t.vn", offset: 0, length: 0, line: 2, column: 3 },
};

const RUN = "run-of-the-file" as RunId;

/** An envelope as the runner sends it, numbered from its own emitter. */
function ran(seq: number): Envelope {
  return { seq, ts: "", run: RUN, kind: "log", data: { level: "info", message: "x" } };
}

/** The run's own ending, which every consumer reads as the last thing it will get. */
function ended(seq: number): Envelope {
  const data = { passed: 1, failed: 0, durationMs: 4 };
  return { seq, ts: "", run: RUN, kind: "run.finished", data };
}

/** Everything a stream carried, and the stream that carried it. */
function opened(): { seen: Envelope[]; stream: ProblemStream } {
  const seen: Envelope[] = [];
  const host = createTestHost();
  return { seen, stream: problemStream({ sink: { emit: (one) => seen.push(one) }, host }) };
}

/**
 * A problem the CLI found and one the runner raised are the same news, and a
 * reporter reads them off one stream. That only works if the second is part of
 * the run it happened in: a stream that starts numbering again at one reads as
 * a gap to anything watching for one.
 */
describe("a problem put on the stream", () => {
  it("travels on failure, which is the envelope for everything not asserted", () => {
    const { seen, stream } = opened();

    stream.say([PROBLEM]);

    expect(seen.map((one) => one.kind)).toEqual(["failure"]);
    expect(seen[0]?.data).toEqual({ problem: PROBLEM });
  });

  it("carries the run's own id and the number after its last, when it ran", () => {
    const { seen, stream } = opened();

    stream.sink.emit(ran(1));
    stream.sink.emit(ran(2));
    stream.say([PROBLEM, PROBLEM]);

    expect(seen.map((one) => one.seq)).toEqual([1, 2, 3, 4]);
    expect(seen.every((one) => one.run === RUN)).toBe(true);
  });

  it("numbers from one, under a run of its own, when nothing ran at all", () => {
    const { seen, stream } = opened();

    stream.say([PROBLEM]);

    expect(seen.map((one) => one.seq)).toEqual([1]);
    expect(seen[0]?.run).toMatch(/^run-/);
  });

  /**
   * Minting a run id draws from the host's seeded random, the one stream the
   * whole program shares, so building the plumbing used to spend the first
   * number the program was going to read: `math.randomInt` answered 4 where
   * every recording of it says 1, in every file, run or not.
   */
  it("takes no number from the host's random until it has something to say", () => {
    const first = createTestHost().random.next();
    const host = createTestHost();

    problemStream({ sink: { emit: () => {} }, host });

    expect(host.random.next()).toBe(first);
  });
});

/**
 * `run.finished` is the last thing a run emits, and a reader is entitled to
 * close its file on it: the runtime asserts it in four suites. This channel
 * carries more than the run, though, because a decorator refused while the
 * program was expanded is only known once the runner has handed its result
 * back. Those went out after the ending, so an NDJSON consumer dropped them and
 * read a refused program as green, and the dot reporter drew its summary and
 * then a bare `!` under it.
 */
describe("the run's ending", () => {
  it("waits for whatever the file still has to say", () => {
    const { seen, stream } = opened();

    stream.sink.emit(ran(1));
    stream.sink.emit(ended(2));
    stream.say([PROBLEM]);
    stream.close();

    expect(seen.map((one) => one.kind)).toEqual(["log", "failure", "run.finished"]);
    expect(seen.map((one) => one.seq)).toEqual([1, 2, 3]);
  });

  it("keeps the number it was given when nothing was said after it", () => {
    const { seen, stream } = opened();

    stream.sink.emit(ran(1));
    stream.sink.emit(ended(2));
    stream.say([]);
    stream.close();

    expect(seen.map((one) => one.kind)).toEqual(["log", "run.finished"]);
    expect(seen.map((one) => one.seq)).toEqual([1, 2]);
  });

  /** A file refused before it ran has no ending to let out, and closing twice is not two. */
  it("is let out once, and only when there was one", () => {
    const { seen, stream } = opened();

    stream.say([PROBLEM]);
    stream.close();
    stream.sink.emit(ended(2));
    stream.close();
    stream.close();

    expect(seen.map((one) => one.kind)).toEqual(["failure", "run.finished"]);
  });
});
