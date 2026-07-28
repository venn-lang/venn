// biome-ignore-all lint/suspicious/noTemplateCurlyInString: ${name} is a placeholder in a path, not a JavaScript template.

/**
 * The dotenv files read when `venn.toml` does not name its own.
 *
 * The order is the precedence, lowest first: what everyone shares, then what
 * this environment adds, then what this machine keeps to itself. The `.local`
 * ones are what a `.gitignore` is for.
 */
export const DOTENV_CONVENTION: readonly string[] = [
  ".env",
  ".env.${name}",
  ".env.local",
  ".env.${name}.local",
];

/**
 * Which files to read, in order, for one environment.
 *
 * The runner and the editor both ask this, so they cannot disagree about where
 * a value lives.
 *
 * @param args.configured - `[env] files` from `venn.toml`. Empty or absent
 * falls back to {@link DOTENV_CONVENTION}.
 * @param args.name - the selected environment, substituted for `${name}`.
 */
export function dotenvFiles(args: { configured?: readonly string[]; name: string }): string[] {
  const names = args.configured?.length ? args.configured : DOTENV_CONVENTION;
  return names.map((each) => each.replaceAll("${name}", args.name));
}
