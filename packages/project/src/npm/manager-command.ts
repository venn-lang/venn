import type { PackageManagerName } from "@venn/contracts";

/** The four verbs Venn proxies to whichever package manager the project chose. */
export type ProxiedVerb = "add" | "remove" | "update" | "install";

/** A package manager invocation, ready to spawn. */
export interface ManagerCommand {
  command: string;
  args: readonly string[];
  /**
   * Whether it has to go through a shell.
   *
   * Every one of these managers ships as a script, and on Windows that means a
   * `.cmd`, which Node refuses to spawn directly because `.cmd` files were used
   * to slip arguments past programs that believed they were spawning an
   * executable. So a shell it is, and because a shell re-reads what it is
   * handed, what goes in is checked first. See {@link isSafeSpec}.
   */
  shell: boolean;
}

/**
 * The command a verb becomes, in the manager this project chose.
 *
 * The interface is ours, the resolution is not: working out which versions
 * satisfy which ranges is years of work against three moving targets, so the
 * four verbs are spelled once here and handed to the tool the project named.
 *
 * @param args.packages Specifiers to act on. Pass each through
 * {@link isSafeSpec} first when `shell` comes back `true`.
 * @returns The command, its arguments, and whether a shell is required.
 */
export function managerCommand(args: {
  manager: PackageManagerName;
  verb: ProxiedVerb;
  packages?: readonly string[];
  dev?: boolean;
  /** `process.platform`. It decides whether a shell is needed. */
  platform: string;
}): ManagerCommand {
  // `-D` means "a development dependency" in every one of them.
  const dev = args.dev ? ["-D"] : [];
  return {
    command: args.manager,
    args: [verbFor(args), ...dev, ...(args.packages ?? [])],
    shell: args.platform === "win32",
  };
}

/** npm spells `add` and `remove` its own way; every other manager agrees. */
function verbFor(args: { manager: PackageManagerName; verb: ProxiedVerb }): string {
  return args.manager === "npm" ? NPM[args.verb] : NON_NPM[args.verb];
}

const NON_NPM: Record<ProxiedVerb, string> = {
  add: "add",
  remove: "remove",
  update: "update",
  install: "install",
};

const NPM: Record<ProxiedVerb, string> = {
  add: "install",
  remove: "uninstall",
  update: "update",
  install: "install",
};

/** A package name, optionally scoped, optionally with a version range. */
const SPEC = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[A-Za-z0-9.^~><=*-]+)?$/;

/**
 * Whether a string is a package specifier and nothing else.
 *
 * The command goes through a shell on Windows, and a shell reads `&`, `|` and
 * `>` as instructions rather than text, so `venn add "x & del /q ."` would
 * delete a directory while looking like an install. A real package name holds
 * none of those characters, so checking costs nothing and closes the hole
 * instead of documenting it.
 *
 * @returns `true` when the string is safe to hand to a shell.
 */
export function isSafeSpec(spec: string): boolean {
  return SPEC.test(spec);
}
