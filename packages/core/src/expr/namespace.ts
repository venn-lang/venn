const NAMESPACE = Symbol("venn.namespace");

/**
 * A plugin namespace as a value (`fmt`, `data`, `crypto`), so its verbs can be
 * called from any expression: `print(fmt.table(rows))`.
 *
 * Marked, because a name the user binds must still win over a namespace of the
 * same name, and a bare `data.faker.uuid` must still read as a call rather than
 * as the function itself.
 */
export function namespaceValue(members: Record<string, unknown>): Record<string, unknown> {
  return Object.assign(Object.create(null) as Record<string, unknown>, members, {
    [NAMESPACE]: true,
  });
}

/** Whether this value is a namespace rather than an ordinary map. */
export function isNamespaceValue(value: unknown): boolean {
  return typeof value === "object" && value !== null && NAMESPACE in value;
}
