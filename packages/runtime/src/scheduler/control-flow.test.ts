import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

const plugin = definePlugin({
  name: "@test/t",
  namespace: "t",
  actions: [
    defineAction({ name: "echo", run: (_ctx, input) => input.args[0] }),
    defineAction({
      name: "boom",
      run: () => {
        throw new Error("boom");
      },
    }),
  ],
});

const SOURCE = `fragment double(x) -> int {
  step "d" { expect x == 5 }
}

flow "F" {
  let n = 5
  if n == 5 { step "a" { expect n == 5 } } else { step "b" { expect false } }
  forEach x in [1, 2, 3] { step "e" { expect x > 0 } }
  repeat 3 as i { expect i <= 3 }
  run double(5)
  try {
    step "r" { t.boom }
  } catch err {
    expect err.message == "boom"
  } finally {
    expect true
  }
  parallel {
    step "p1" { expect true }
    step "p2" { expect true }
  }
  defer { expect true }
}`;

/**
 * `step "r"` fails and says so under its own name, and the `try` around it
 * catches the unwind rather than un-saying the verdict: a run reporting 0 over
 * a stream carrying `step.finished status:"failed"` contradicts itself.
 * `try { expect … } catch` is still the expected-failure idiom, because an
 * assertion nobody reports is an assertion nobody counts.
 */
describe("control flow", () => {
  it("runs if/forEach/repeat/fragment/try/parallel/defer to completion", async () => {
    const { ast, problems } = parse(SOURCE);
    expect(problems).toEqual([]);
    const sink = createMemorySink();
    const runner = createRunner({ host: createTestHost(), plugins: [plugin], sink });

    const result = await runner.run(ast);

    // 1(if) + 3(forEach) + 3(repeat) + 1(fragment) + 1(catch) + 1(finally) + 2(parallel) + 1(defer)
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(13);
  });
});
