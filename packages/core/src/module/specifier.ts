/** What a specifier written in an `import` names. */
export type SpecifierKind = "relative" | "alias" | "package";

/**
 * Which of the three a specifier is.
 *
 * The rule is Node's, so there is no `npm:` prefix and nothing new to learn:
 * `./util.vn` is a file beside this one, `#shared/auth.vn` goes through
 * `[paths]`, and a bare `zod` is an installed package. The shape of what is
 * written already says which it is.
 */
export function specifierKind(spec: string): SpecifierKind {
  if (spec.startsWith(".") || spec.startsWith("/")) return "relative";
  if (spec.startsWith("#")) return "alias";
  return "package";
}

/** Whether the specifier names an installed package rather than a file. */
export function isPackageSpecifier(spec: string): boolean {
  return specifierKind(spec) === "package";
}
