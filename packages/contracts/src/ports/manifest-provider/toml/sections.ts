// Opening `[a.b]` or `[[a.b]]`: working out where the keys that follow go.

/** The table `[path]` names, created along the way if it is not there yet. */
export function enterSection(root: Record<string, unknown>, path: string): Record<string, unknown> {
  let node = root;
  for (const key of keysOf(path)) {
    node[key] ??= {};
    node = node[key] as Record<string, unknown>;
  }
  return node;
}

/**
 * `[[bin]]`: one more of something there may be several of.
 *
 * Returns the table just appended, so two `[[bin]]` sections give two bins
 * rather than one bin written twice.
 */
export function enterTableArray(
  root: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  const keys = keysOf(path);
  const last = keys.pop();
  if (!last) return root;
  const parent = enterSection(root, keys.join("."));
  const found = Array.isArray(parent[last]) ? (parent[last] as unknown[]) : [];
  parent[last] = found;
  const table: Record<string, unknown> = {};
  found.push(table);
  return table;
}

function keysOf(path: string): string[] {
  return path
    .split(".")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter((part) => part !== "");
}
