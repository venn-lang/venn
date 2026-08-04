import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { everyConstruct, exercisedBy } from "./constructs.js";
import { createDriver } from "./drive.js";
import { parseCase } from "./parse-case.js";
import { PLACEMENTS, sourceFor } from "./placements.js";
import type { Answer, Answers, Case, Pinned } from "./same-everywhere.types.js";

const CORPUS = join(import.meta.dirname, "..", "..", "corpus");
const PINNED = join(CORPUS, "expected.json");
const NO_CASE = join(CORPUS, "constructs-baseline.json");

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

/** What the corpus knows the two paths still disagree about, and where it is filed. */
const FILED: readonly string[] = [];

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
 * Every construct of the grammar with no case, held at exactly the list that
 * has none today.
 *
 * The corpus reaches as far as the bodies somebody thought to write, and
 * nothing made a new construct enter it. This does: the constructs come from
 * the grammar, so a rule added to `venn.langium` shows up here with no edit
 * anywhere, and fails by name in the commit that adds it. The frozen list only
 * shrinks, because a construct that gains a case has to leave it, in a diff a
 * reviewer reads.
 *
 * `VENN_WRITE_CORPUS=1` records it, the way the pinned answers are recorded.
 */
async function everyConstructHasACaseOrIsWrittenDown(): Promise<void> {
  const { cases } = await driveAll();
  const exercised = exercisedBy(cases);
  const missing = everyConstruct().filter((one) => !exercised.has(one));
  if (process.env.VENN_WRITE_CORPUS) {
    await writeFile(NO_CASE, `${JSON.stringify(missing, null, 2)}\n`, "utf8");
    return;
  }

  expect(missing).toEqual(JSON.parse(await readFile(NO_CASE, "utf8")));
}

/**
 * A survey that credited a case with what the wrapper around it wrote would
 * agree with any baseline, and would say so in the same words as a real one.
 */
async function surveysTheBodyAndNotTheWrapper(): Promise<void> {
  const { cases } = await driveAll();
  const empty = { ...(cases[0] as Case), body: "" };

  expect([...exercisedBy([empty])]).toEqual([]);
  expect(exercisedBy(cases).size).toBeGreaterThan(10);
  expect(everyConstruct()).toContain("ForEachStmt");
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
  it(
    "has a case for every construct, or has it written down",
    A_WHILE,
    everyConstructHasACaseOrIsWrittenDown,
  );
  it("surveys the body and not the wrapper around it", A_WHILE, surveysTheBodyAndNotTheWrapper);
});
