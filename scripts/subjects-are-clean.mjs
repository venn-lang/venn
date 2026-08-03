/**
 * The two rules about writing that reach a place no guard could look.
 *
 * `no-dashes.test.mjs` reads `git ls-files`, so by construction it never sees a
 * commit message or a pull request title, and the charter itself is untracked
 * so it is not covered either. Those are exactly where the rules get broken:
 * the dash comes back in prose written in a hurry, and the attribution trailer
 * is what a tool adds by default unless it is told not to.
 *
 * The title matters twice over. The repository merges with `merge_commit_title
 * = PR_TITLE`, so the title is the commit that lands on `main`.
 *
 * `node scripts/subjects-are-clean.mjs <base> <head> [title]` reads the range
 * and prints every message that breaks one, which is what CI runs.
 */
import { execFileSync } from "node:child_process";

/**
 * Built from the code points rather than written out, so this file is not the
 * thing it forbids and the guard cannot fail on itself.
 */
const DASHES = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`, "g");

/**
 * Attribution a tool adds by itself, named rather than guessed at.
 *
 * `assistant` and `cursor` are left out on purpose: both are ordinary English
 * this repository already writes, `cursor` seven times in messages about the
 * editor, and a guard that cries over a real word is a guard somebody deletes.
 */
const CREDITED =
  /co-authored-by|generated with|\bclaude\b|\bcopilot\b|\bchatgpt\b|\banthropic\b|\bopenai\b|\bgemini\b|ai-generated|🤖/i;

/** Everything wrong with one piece of writing, said in the words to fix it. */
export function complaints(what, text) {
  const found = [];
  for (const dash of text.match(DASHES) ?? []) {
    const named = dash === String.fromCharCode(0x2014) ? "em" : "en";
    found.push(
      `${what} holds an ${named} dash. Rewrite the sentence with a comma, a colon, a bracket or a full stop.`,
    );
  }
  const credit = CREDITED.exec(text);
  if (credit)
    found.push(
      `${what} credits "${credit[0]}". No tool is named in this repository, in a message, a title or a trailer.`,
    );
  return found;
}

/**
 * A ref that exists, from the ones a caller might mean by "the base".
 *
 * `main` is a local branch on a developer's machine and is usually absent in
 * CI, where the checkout is of the pull request and the base arrives as
 * `origin/main` or as nothing at all. A guard that only runs in one of the two
 * places is not a guard, and one that passes when it cannot compare is worse.
 *
 * @param base What the caller asked for.
 * @returns The first ref that resolves, or `undefined` when none does.
 */
export function baseThatExists(base) {
  for (const ref of [base, `origin/${base}`, `refs/remotes/origin/${base}`]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return ref;
    } catch {
      // The next spelling, or nothing.
    }
  }
  return undefined;
}

/** Every commit message in the range, subject and body, newest last. */
export function messagesIn(base, head) {
  const from = baseThatExists(base);
  if (!from) {
    throw new Error(
      `No ref named ${base} or origin/${base}, so there is nothing to compare ${head} against. ` +
        "In CI, fetch the base branch: actions/checkout with fetch-depth: 0.",
    );
  }
  const said = execFileSync("git", ["log", "--format=%H%x00%B%x00", `${from}..${head}`], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  return said
    .split("\0")
    .reduce(paired, [])
    .filter((one) => one.text.trim().length > 0);
}

function paired(so, part, at) {
  if (at % 2 === 1) so.push({ sha: so.pop()?.sha ?? "", text: part });
  else so.push({ sha: part.trim().slice(0, 8), text: "" });
  return so;
}

/** Everything wrong with a range of commits and the title they will merge under. */
export function wrongWith(args) {
  const found = args.title ? complaints(`the title "${args.title}"`, args.title) : [];
  for (const { sha, text } of messagesIn(args.base, args.head)) {
    found.push(...complaints(`commit ${sha}`, text));
  }
  return found;
}

if (process.argv[1]?.endsWith("subjects-are-clean.mjs")) {
  const [base, head, title] = process.argv.slice(2);
  const found = wrongWith({ base, head, title });
  process.stdout.write(found.length === 0 ? "every message is clean\n" : `${found.join("\n")}\n`);
  process.exitCode = found.length === 0 ? 0 : 1;
}
