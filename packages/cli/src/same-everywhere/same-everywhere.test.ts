import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDriver } from "./drive.js";
import { parseCase } from "./parse-case.js";
import { PLACEMENTS, sourceFor } from "./placements.js";
import type { Answer, Answers, Case, Pinned } from "./same-everywhere.types.js";

const CORPUS = join(import.meta.dirname, "..", "..", "corpus");
const PINNED = join(CORPUS, "expected.json");

/** Every case on disk, in name order, so a failure always reads the same. */
async function corpus(): Promise<Case[]> {
  const names = (await readdir(CORPUS)).filter((one) => one.endsWith(".vn")).toSorted();
  const read = names.map(async (one) => {
    return parseCase(one.slice(0, -3), await readFile(join(CORPUS, one), "utf8"));
  });
  return Promise.all(read);
}

async function pinned(): Promise<Pinned> {
  return JSON.parse(await readFile(PINNED, "utf8"));
}

/** Every placement of one case driven, the excluded ones left out. */
async function answersFor(one: Case, drive: (source: string) => Promise<Answer>): Promise<Answers> {
  const found: Record<string, Answer> = {};
  for (const placement of PLACEMENTS) {
    if (one.excludes.has(placement)) continue;
    found[placement] = await drive(sourceFor(placement, one.body));
  }
  return found;
}

/** The whole corpus driven once, shared by every assertion below. */
async function drivenOnce(): Promise<{ cases: Case[]; now: Pinned }> {
  const driver = createDriver();
  const cases = await corpus();
  const now: Record<string, Answers> = {};
  for (const one of cases) now[one.name] = await answersFor(one, driver.answer);
  return { cases, now };
}

let driving: Promise<{ cases: Case[]; now: Pinned }> | undefined;

/** Driven once for the whole file: three assertions read the same answers. */
function driveAll(): Promise<{ cases: Case[]; now: Pinned }> {
  driving ??= drivenOnce();
  return driving;
}

/** Placements this case has already accounted for, whichever word it used. */
function spokenFor(one: Case): Set<string> {
  return new Set([...one.differs.keys(), ...one.open.keys()]);
}

/**
 * Which placements disagreed with the first one that ran, minus those the case
 * already accounted for.
 */
function drifted(one: Case, answers: Answers): string[] {
  const names = Object.keys(answers);
  const reference = JSON.stringify(answers[names[0] as string]);
  const said = spokenFor(one);
  return names
    .slice(1)
    .filter((name) => !said.has(name) && JSON.stringify(answers[name]) !== reference)
    .map((name) => `${one.name}: ${name} answers ${JSON.stringify(answers[name])}`)
    .concat(sameAnyway(one, answers, reference));
}

/** A header line for a placement that no longer differs is one nobody needs. */
function sameAnyway(one: Case, answers: Answers, reference: string): string[] {
  return [...spokenFor(one)]
    .filter((name) => answers[name] && JSON.stringify(answers[name]) === reference)
    .map((name) => `${one.name}: ${name} no longer differs, so drop the header line`);
}

/** Every divergence a case has filed rather than fixed, with its reason. */
function stillOpen(cases: readonly Case[]): string[] {
  return cases.flatMap((one) => [...one.open].map(([at, why]) => `${one.name}: ${at}, ${why}`));
}

const NO_BLOCK_SCOPE = "issue 265, a compiled body flattens every block into one slot list";
const ONE_SLOT_PER_LOOP =
  "issue 264, a compiled pass reuses one slot so every closure reads the last";
const A_SLOT_OUTLIVES_A_PASS =
  "issue 264, a compiled pass reuses one slot so a pass reads what the one before it bound";

/** What the corpus knows the two paths still disagree about, and where it is filed. */
const FILED: readonly string[] = [
  `030-a-let-inside-a-repeat-shadows: fnDecl, ${NO_BLOCK_SCOPE}`,
  `030-a-let-inside-a-repeat-shadows: fnExpr, ${NO_BLOCK_SCOPE}`,
  `031-a-let-inside-a-foreach-shadows: fnDecl, ${NO_BLOCK_SCOPE}`,
  `031-a-let-inside-a-foreach-shadows: fnExpr, ${NO_BLOCK_SCOPE}`,
  `032-a-let-inside-an-if-shadows: fnDecl, ${NO_BLOCK_SCOPE}`,
  `032-a-let-inside-an-if-shadows: fnExpr, ${NO_BLOCK_SCOPE}`,
  `033-a-loop-binding-is-gone-after-its-loop: fnDecl, ${NO_BLOCK_SCOPE}`,
  `033-a-loop-binding-is-gone-after-its-loop: fnExpr, ${NO_BLOCK_SCOPE}`,
  `034-a-block-local-is-gone-after-its-block: fnDecl, ${NO_BLOCK_SCOPE}`,
  `034-a-block-local-is-gone-after-its-block: fnExpr, ${NO_BLOCK_SCOPE}`,
  `035-a-nested-block-binds-its-own: fnDecl, ${NO_BLOCK_SCOPE}`,
  `035-a-nested-block-binds-its-own: fnExpr, ${NO_BLOCK_SCOPE}`,
  `060-a-closure-made-in-a-foreach-pass: fnDecl, ${ONE_SLOT_PER_LOOP}`,
  `060-a-closure-made-in-a-foreach-pass: fnExpr, ${ONE_SLOT_PER_LOOP}`,
  `061-a-closure-made-in-a-repeat-pass: fnDecl, ${ONE_SLOT_PER_LOOP}`,
  `061-a-closure-made-in-a-repeat-pass: fnExpr, ${ONE_SLOT_PER_LOOP}`,
  `062-a-closure-made-in-a-loop-pass: fnDecl, ${ONE_SLOT_PER_LOOP}`,
  `062-a-closure-made-in-a-loop-pass: fnExpr, ${ONE_SLOT_PER_LOOP}`,
  `063-a-body-local-read-before-its-own-let: fnDecl, ${A_SLOT_OUTLIVES_A_PASS}`,
  `063-a-body-local-read-before-its-own-let: fnExpr, ${A_SLOT_OUTLIVES_A_PASS}`,
];

async function agreesEverywhere(): Promise<void> {
  const { cases, now } = await driveAll();
  const wrong = cases.flatMap((one) => drifted(one, now[one.name] as Answers));

  expect(wrong).toEqual([]);
}

/**
 * `VENN_WRITE_CORPUS=1 pnpm --filter @venn-lang/runtime test` records what the
 * tree does now, the way `scripts/examples-run.mjs --write` does. Without it the
 * recorded answers are the assertion, so a fix is a reviewable diff in that file
 * and a regression is a failure here.
 */
async function matchesThePin(): Promise<void> {
  const { now } = await driveAll();
  if (process.env.VENN_WRITE_CORPUS) {
    await writeFile(PINNED, `${JSON.stringify(now, null, 2)}\n`, "utf8");
    return;
  }

  expect(now).toEqual(await pinned());
}

/**
 * The divergences that are known and filed, listed rather than hidden.
 *
 * Compared against {@link FILED} so that filing one more is a deliberate line in
 * a reviewed diff rather than a header line nobody reads, and so that fixing one
 * fails until the header line goes too.
 */
async function filesWhatItHasNotFixed(): Promise<void> {
  const { cases } = await driveAll();

  expect(stillOpen(cases)).toEqual(FILED);
}

/** A corpus nobody could read would agree with itself, and say so in these words. */
async function reallyRuns(): Promise<void> {
  const { cases, now } = await driveAll();

  expect(cases.length).toBeGreaterThan(20);
  expect(Object.values(now).flatMap((one) => Object.keys(one)).length).toBeGreaterThan(60);
}

/**
 * Every case at every placement, parsed, analysed and run. Under a second on
 * its own; the room is for a machine with sixty-nine other test files of this
 * package running beside it.
 */
const A_WHILE = { timeout: 30_000 };

describe("the same lines, written in each of the places the language compiles them", () => {
  it("answers the same in every placement, or says in the case why not", A_WHILE, agreesEverywhere);
  it("answers what was recorded for it", A_WHILE, matchesThePin);
  it("has filed exactly the divergences it has not fixed", A_WHILE, filesWhatItHasNotFixed);
  it("is read from disk and really runs", A_WHILE, reallyRuns);
});
