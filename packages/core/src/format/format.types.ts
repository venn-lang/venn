/** How to format a `.vn` file. Mirrors the `[format]` table of `venn.toml`. */
export interface FormatOptions {
  /** Spaces per indent level. Ignored when {@link useTabs} is on. */
  indentWidth: number;
  useTabs: boolean;
  /** Move every `use` above every `import`. */
  organizeHeader: boolean;
  /** Sort each header group alphabetically. */
  sortHeader: boolean;
}

/** What the formatter does when `venn.toml` says nothing. */
export const DEFAULT_FORMAT: FormatOptions = {
  indentWidth: 2,
  useTabs: false,
  organizeHeader: true,
  sortHeader: false,
};
