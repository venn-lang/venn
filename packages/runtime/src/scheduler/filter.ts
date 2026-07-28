/** A title matches when the needle is absent, or contained case-insensitively. */
export function matchesTitle(title: string, needle: string | undefined): boolean {
  if (!needle) return true;
  return title.toLowerCase().includes(needle.toLowerCase());
}
