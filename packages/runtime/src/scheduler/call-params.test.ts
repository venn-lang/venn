import { createTestHost } from "@venn/contracts";
import { type Problem, ProblemError, parse } from "@venn/core";
import { defineAction, defineMatcher, definePlugin, z } from "@venn/sdk";
import { describe, expect, it } from "vitest";
import { checkDocument } from "../check/index.js";
import { createMemorySink } from "../eventsink/index.js";
import { buildRegistry } from "../registry/index.js";
import { createRunner } from "../run/create-runner.js";

/** Stand-ins for the option shapes the stdlib actually uses. */
function plugin(seen: unknown[]) {
  return definePlugin({
    name: "@t/m",
    version: "0",
    namespace: "t",
    actions: [
      // `crypto.hash`: one enum option with a default, so a dropped key is invisible.
      defineAction({
        name: "hash",
        params: z.object({ algorithm: z.enum(["sha1", "sha256"]).default("sha256") }).optional(),
        run: (_ctx, input) => record(seen, input.params),
      }),
      defineAction({
        name: "hmac",
        params: z.object({ key: z.string(), rounds: z.number().optional() }),
        run: (_ctx, input) => record(seen, input.params),
      }),
      // `grpc.request`: a free-form map, where no key can be unknown.
      defineAction({
        name: "call",
        params: z.record(z.string(), z.unknown()).optional(),
        run: (_ctx, input) => record(seen, input.params),
      }),
      // A schema that names its keys and still welcomes the ones it did not name.
      defineAction({
        name: "post",
        params: z.looseObject({ path: z.string() }),
        run: (_ctx, input) => record(seen, input.params),
      }),
      // `db.seed`: no schema at all, and the whole map is the payload.
      defineAction({ name: "seed", run: (_ctx, input) => record(seen, input.params) }),
    ],
    matchers: [
      // `closeTo`: one option with a default, so a dropped key is invisible here too.
      defineMatcher({
        name: "closeTo",
        params: z.object({ within: z.number().default(0.001) }),
        test: ({ subject, args, params }) =>
          Math.abs(Number(subject) - Number(args[0])) <= params.within,
        message: () => "expected the two to be close",
      }),
    ],
  });
}

function record(seen: unknown[], params: unknown): unknown {
  seen.push(params);
  return params;
}

const source = (call: string): string => `use "@t/m"\n${call}\n`;

interface Attempt {
  /** The options each action was handed; empty when it never ran. */
  seen: unknown[];
  problem?: Problem;
}

/** Run as a script, where a failed statement carries its Problem out to here. */
async function attempt(text: string): Promise<Attempt> {
  const seen: unknown[] = [];
  const { ast, problems } = parse(text);
  expect(problems).toEqual([]);
  const runner = createRunner({
    host: createTestHost(),
    plugins: [plugin(seen)],
    sink: createMemorySink(),
  });
  const thrown = await runner.script(ast).then(
    () => undefined,
    (error: unknown) => error,
  );
  if (thrown !== undefined && !(thrown instanceof ProblemError)) throw thrown;
  return { seen, problem: thrown?.problem };
}

/** What `venn check` says about the same file, for comparing the two voices. */
function checked(text: string): Problem[] {
  return checkDocument({
    document: parse(text).ast,
    registry: buildRegistry({ plugins: [plugin([])], caps: createTestHost().caps }),
    fragments: new Set(),
  });
}

describe("an option key the schema never declared", () => {
  const typo = source('t.hash "abc" { algorithmm: "sha1" }');

  // Zod strips what it does not know, so unchecked this hashes with the default
  // and answers sha256: the typo costs a silently different digest.
  it("stops the call instead of dropping the key in silence", async () => {
    const { seen, problem } = await attempt(typo);

    expect(problem?.code).toBe("VN3001");
    expect(seen).toEqual([]);
  });

  it("suggests the key that was meant", async () => {
    const { problem } = await attempt(typo);

    expect(problem?.title).toContain('did you mean "algorithm"');
  });

  it("says exactly what the checker says about the same line", async () => {
    const { problem } = await attempt(typo);

    expect(checked(typo).map((found) => `${found.code} ${found.title}`)).toContain(
      `${problem?.code} ${problem?.title}`,
    );
  });

  it("leaves a free-form map alone — a schema with no keys declares none", async () => {
    const { seen, problem } = await attempt(source('t.call "x" { whatever: 1 }'));

    expect(problem).toBeUndefined();
    expect(seen).toEqual([{ whatever: 1 }]);
  });

  it("leaves an action with no schema alone", async () => {
    const { seen, problem } = await attempt(source("t.seed { users: 2 }"));

    expect(problem).toBeUndefined();
    expect(seen).toEqual([{ users: 2 }]);
  });

  // A schema that takes a catchall says so; refusing the extra key here would
  // refuse a map the action asked to receive.
  it("leaves a schema that welcomes unnamed keys alone", async () => {
    const { seen, problem } = await attempt(source('t.post { path: "/a", trace: true }'));

    expect(problem).toBeUndefined();
    expect(seen).toEqual([{ path: "/a", trace: true }]);
  });
});

describe("an option value the schema rejects", () => {
  // Uncaught, the ZodError escapes and its `message`, a JSON array of issues,
  // becomes the failure title.
  it("reads as one line about the option, not a dump of issues", async () => {
    const { problem } = await attempt(source('t.hash "abc" { algorithm: "sha5" }'));

    expect(problem?.code).toBe("VN3010");
    expect(problem?.title).toBe('"algorithm" must be one of "sha1", "sha256" — not "sha5".');
    expect(problem?.title).not.toContain("\n");
  });

  it("names the type it wanted and the type it got", async () => {
    const { problem } = await attempt(source('t.hmac "x" { key: 42 }'));

    expect(problem?.title).toBe('"key" needs a string, and 42 is a number.');
  });

  it("says which option is missing", async () => {
    const { problem } = await attempt(source('t.hmac "x" { rounds: 2 }'));

    expect(problem?.title).toBe('"key" is required here, and it takes a string.');
    // Nothing was written to underline, so the map itself carries the squiggle.
    expect(problem?.span.length).toBe("{ rounds: 2 }".length);
  });

  it("points at the option that failed, not at the whole map", async () => {
    const { problem } = await attempt(source('t.hmac "x" { key: 42 }'));

    expect(problem?.span.line).toBe(2);
    expect(problem?.span.length).toBe("key: 42".length);
  });
});

describe("where the failure points when no options map was written", () => {
  it("underlines the call, not the top of the file", async () => {
    const { problem } = await attempt(source('t.hmac "x"'));

    expect(problem?.title).toBe('"key" is required here, and it takes a string.');
    expect(problem?.span.line).toBe(2);
    expect(problem?.span.length).toBe('t.hmac "x"'.length);
  });

  it("underlines the binding when the call is spelled as a `let`", async () => {
    const { problem } = await attempt(source('let sig = t.hmac "x"'));

    expect(problem?.span.line).toBe(2);
    expect(problem?.span.length).toBe('let sig = t.hmac "x"'.length);
  });
});

// A matcher takes an options map on the same terms an action does, and nothing
// checks it before the run: `checkOptions` only ever sees calls.
describe("a matcher's options map", () => {
  it("refuses a key the matcher never declared", async () => {
    const { problem } = await attempt(source("expect 1.0 closeTo 1.5 { withinn: 1 }"));

    expect(problem?.code).toBe("VN3001");
    expect(problem?.title).toContain('did you mean "within"');
  });

  it("reads a rejected value as one line, not a dump of issues", async () => {
    const { problem } = await attempt(source('expect 1.0 closeTo 1.5 { within: "soon" }'));

    expect(problem?.code).toBe("VN3010");
    expect(problem?.title).toBe('"within" needs a number, and "soon" is a string.');
    expect(problem?.span.line).toBe(2);
  });

  it("still applies an option it accepts", async () => {
    const { problem } = await attempt(source("expect 1.0 closeTo 1.5 { within: 1 }"));

    expect(problem).toBeUndefined();
  });
});
