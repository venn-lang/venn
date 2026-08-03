/** Always there: the runner sets it to whichever `--env` was selected. */
const SELECTED = "name";

/**
 * Every variable a project declares, whichever environment runs.
 *
 * The union of every `[env.*]` section and of whatever the dotenv files add,
 * plus the built-in `name`. The union rather than the selected environment,
 * because `venn check` has no environment to select and the editor cannot know
 * which one a run will pick, and three commands answering this three different
 * ways is how a variable kept out of the repository, which is what `.env` is
 * for, came to fail CI and run fine.
 *
 * @param args.sections The `[env.*]` sections, or `undefined` where no manifest
 * was found at all.
 * @param args.dotenv The names the dotenv files hold, already read.
 * @returns The declared names, or `undefined` when there is no manifest: with
 * nothing to compare against, every `env.*` read would look undeclared, and a
 * wrong error about a variable that does exist is worse than no error.
 */
export function declaredEnvNames(args: {
  sections: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined;
  dotenv?: Iterable<string>;
}): readonly string[] | undefined {
  if (!args.sections) return undefined;
  const names = new Set<string>([SELECTED]);
  for (const vars of Object.values(args.sections))
    for (const key of Object.keys(vars)) {
      names.add(key);
    }
  for (const key of args.dotenv ?? []) names.add(key);
  return [...names];
}
