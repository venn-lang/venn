import { createTestHost } from "@venn-lang/contracts";
import { type Document, type Problem, type ProblemError, parse } from "@venn-lang/core";
import {
  collectFragments,
  createFrontEnd,
  createMemorySink,
  createRunner,
  type FrontEnd,
  NOTHING_IMPORTED,
} from "@venn-lang/runtime";
import { defineAction, definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import type { Answer, Driver, Refusal } from "./same-everywhere.types.js";

const URI = "memory://corpus.vn";

/** The one namespace a corpus body may reach, so a case can record what it did. */
function recorder(out: string[]): PluginDefinition {
  return definePlugin({
    name: "@t/io",
    version: "0",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => void out.push(input.args.map(String).join(" ")),
      }),
    ],
  });
}

/**
 * Build the driver once for the whole corpus.
 *
 * The front end settles the registry, the decorators and the type catalog on
 * construction, and reading them again per case is work whose answer never
 * changes. The runner is per case, because each one needs its own recorder.
 *
 * @returns A driver whose `answer` runs every pass and then the program itself.
 */
export function createDriver(): Driver {
  const host = createTestHost();
  const frontEnd = createFrontEnd({ plugins: [recorder([])], caps: host.caps });
  return { answer: (source) => answer(source, frontEnd) };
}

async function answer(source: string, frontEnd: FrontEnd): Promise<Answer> {
  const parsed = parse(`${source}\n`, { uri: URI });
  const problems = [...parsed.problems, ...analysed(parsed.ast, frontEnd)];
  const ran = await outcomeOf(parsed.ast);
  return { problems: problems.map(shown), out: ran.out, refused: ran.refused };
}

function analysed(document: Document, frontEnd: FrontEnd): readonly Problem[] {
  return frontEnd.analyze({
    document,
    uri: URI,
    graph: NOTHING_IMPORTED,
    decos: new Map(),
    fragments: new Set(collectFragments(document).keys()),
    env: undefined,
    packages: new Map(),
    unreadable: [],
    cycles: [],
  }).problems;
}

/**
 * A problem as the corpus records it: what it is, how loud, where, and what it
 * said.
 *
 * The sentence is compared because it is the one the user reads, and the
 * charter makes it the product's voice in the user's own domain. A refusal's
 * title was already kept; leaving a diagnostic's out meant a message that
 * changed to something wrong read here as no change at all.
 */
function shown(problem: Problem): string {
  return `${problem.code} ${problem.severity}@${problem.span.column} ${problem.title}`;
}

/**
 * The program run, whatever the front end thought of it.
 *
 * Run even when a problem was reported, because a false diagnostic is exactly
 * what hides a runtime answer: `venn run` refuses first, so a case whose checker
 * is wrong would have no runtime answer to compare at all.
 */
interface Outcome {
  out: string | null;
  refused: Refusal | null;
}

async function outcomeOf(document: Document): Promise<Outcome> {
  const out: string[] = [];
  const runner = createRunner({
    host: createTestHost(),
    plugins: [recorder(out)],
    sink: createMemorySink(),
    uri: URI,
  });
  try {
    await runner.script(document);
    return { out: out.join("|"), refused: null };
  } catch (error) {
    return { out: out.length > 0 ? out.join("|") : null, refused: refusalOf(error) };
  }
}

/**
 * A refusal, normalised.
 *
 * A host error is kept with an empty code rather than dropped: a program the
 * checker approved reaching the user as a raw `TypeError`, with no VN code and
 * no span, is the thing worth seeing and not the thing to hide.
 */
function refusalOf(error: unknown): Refusal {
  const problem = (error as ProblemError).problem;
  if (!problem)
    return { code: "", title: String((error as Error).message), help: null, column: -1 };
  return {
    code: problem.code,
    title: problem.title,
    help: problem.help ?? null,
    column: problem.span.column,
  };
}
