import { ConsolePort, createMemoryConsole, createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";

const NEWLINE = String.fromCharCode(10);

import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

/**
 * A plugin whose verbs suspend, so the loop takes its awaiting path.
 *
 * `slow.next` hands back a number one turn of the event loop later, which is
 * what a real action does: the loop has to carry a value across a suspension.
 */
const SLOW = definePlugin({
  name: "@t/slow",
  namespace: "slow",
  actions: [
    defineAction({
      name: "next",
      run: async (_ctx, call) => {
        await Promise.resolve();
        return Number(call.args[0] ?? 0) + 1;
      },
    }),
    defineAction({
      name: "yes",
      run: async () => {
        await Promise.resolve();
        return true;
      },
    }),
  ],
});

/** Every line a program printed, running it in script mode. */
async function run(source: string): Promise<string[]> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const console = createMemoryConsole();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [SLOW],
    sink: createMemorySink(),
    ports: [{ port: ConsolePort, impl: console }],
  });
  await runner.script(ast);
  return console.out.split("\n").filter((line) => line !== "");
}

describe("loop", () => {
  it("runs until break, with nothing to say when to stop", async () => {
    expect(await run('loop {\n  print "once"\n  break\n}')).toEqual(["once"]);
  });

  it("runs while a condition holds", async () => {
    const source = 'const xs = [1, 2]\nloop xs.len > 0 {\n  print "${xs.len} left"\n  break\n}';

    expect(await run(source)).toEqual(["2 left"]);
  });

  it("does not run at all when the condition starts false", async () => {
    expect(await run('loop false {\n  print "never"\n}\nprint "after"')).toEqual(["after"]);
  });

  /**
   * The reason this exists. A value crosses the boundary through `continue`, so
   * each pass binds the name once and nothing is assigned.
   */
  it("carries a value from one pass to the next", async () => {
    const source = `loop total = 0 {
  if total >= 6 { break }
  print "at \${total}"
  continue total + 2
}`;

    expect(await run(source)).toEqual(["at 0", "at 2", "at 4"]);
  });

  it("leaves the last value bound after the loop", async () => {
    const source = `loop total = 0 {
  if total >= 6 { break }
  continue total + 2
}
print "ended at \${total}"`;

    expect(await run(source)).toEqual(["ended at 6"]);
  });

  it("repeats the pass with the same value on a bare continue", async () => {
    const source = `loop seen = 0 {
  if seen == 2 { break }
  print "pass"
  continue seen + 1
}`;

    expect(await run(source)).toEqual(["pass", "pass"]);
  });

  /** The case the 100,000 iteration cap used to kill: a program meant to run on. */
  it("is not capped", async () => {
    const source = `loop frame = 0 {
  if frame == 200000 { break }
  continue frame + 1
}
print "survived \${frame}"`;

    expect(await run(source)).toEqual(["survived 200000"]);
  });

  /**
   * Anything that suspends puts the loop on its awaiting path, and the carried
   * value has to survive the crossing.
   */
  it("carries a value across a suspension", async () => {
    const source = `import { slow } from "@t/slow"

loop total = 0 {
  if total >= 3 { break }
  continue slow.next(total)
}
print "reached \${total}"`;

    expect(await run(source)).toEqual(["reached 3"]);
  });

  it("waits on a condition that suspends", async () => {
    const source = `import { slow } from "@t/slow"

loop count = 0 {
  if count >= 2 { break }
  const ok = slow.yes
  print "pass \${count}"
  continue count + 1
}`;

    expect(await run(source)).toEqual(["pass 0", "pass 1"]);
  });

  it("breaks out of a pass that had suspended", async () => {
    const source = `import { slow } from "@t/slow"

loop at = 0 {
  const n = slow.next(at)
  if n >= 2 { break }
  print "at \${n}"
  continue n
}`;

    expect(await run(source)).toEqual(["at 1"]);
  });

  /** The double the three tests above depend on: it really does suspend. */
  it("reads a value back from an action that suspends", async () => {
    const printed = await run('import { slow } from "@t/slow"\n\nconst n = slow.next(41)\nprint n');

    expect(printed).toEqual(["42"]);
  });

  /** A bare `continue` in a loop with no state at all: nothing to carry. */
  it("takes a bare continue in a loop that carries nothing", async () => {
    const source = `loop count = 0 {
  if count == 3 { break }
  if count == 1 {
    print "skipped one"
    continue count + 1
  }
  print "saw \${count}"
  continue count + 1
}`;

    expect(await run(source)).toEqual(["saw 0", "skipped one", "saw 2"]);
  });

  it("takes break and continue from the nearest loop", async () => {
    const source = `loop outer = 0 {
  if outer == 2 { break }
  loop inner = 0 {
    if inner == 2 { break }
    print "\${outer}.\${inner}"
    continue inner + 1
  }
  continue outer + 1
}`;

    expect(await run(source)).toEqual(["0.0", "0.1", "1.0", "1.1"]);
  });

  it("carries a value of any shape, not only a number", async () => {
    const source = `loop state = { at: 0, seen: [] } {
  if state.at == 2 { break }
  continue { at: state.at + 1, seen: state.seen.push(state.at) }
}
print state.seen`;

    expect(await run(source)).toEqual(["[0, 1]"]);
  });

  /**
   * `loop` is a statement, and a `fn` body is one expression, so it does not go
   * there. That is the existing shape of the language rather than a limit of
   * this loop: a `fragment` is where steps and control flow live.
   */
  /** It used to be refused there, when a `fn` body was bindings and a value. */
  it("goes inside a fn, now that a body can hold statements", () => {
    const { problems } = parse(
      "fn f(xs) {" + NEWLINE + "  loop { break }" + NEWLINE + "  return 1" + NEWLINE + "}",
    );

    expect(problems).toEqual([]);
  });

  it("goes inside a fragment, where control flow belongs", async () => {
    const source = `pub fragment count(upTo) {
  loop at = 0 {
    if at >= upTo { break }
    print "at \${at}"
    continue at + 1
  }
}

flow "f" {
  step "s" { run count(2) }
}`;
    const { problems } = parse(source);

    expect(problems.map((problem) => problem.title)).toEqual([]);
  });
});
