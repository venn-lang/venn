import { namespaceValue, nativeFn } from "@venn-lang/core";
import type { ActionContext, ActionDefinition } from "@venn-lang/sdk";
import type { Registry } from "../registry/index.js";
import type { Scope } from "../scope/index.js";

/**
 * Put every plugin namespace in the root scope as a value, so its verbs work
 * inside any expression (`print(fmt.table(rows))`, `"${crypto.hash(x)}"`) and
 * not only as a bare statement.
 *
 * A verb reached this way runs synchronously: it is the pure corner of the
 * stdlib (`fmt`, `data`, `crypto`). An action that does I/O returns its promise,
 * so those stay written as statements, where the runtime awaits them.
 */
export function bindNamespaces(args: {
  registry: Registry;
  ctx: ActionContext;
  scope: Scope;
}): void {
  const byNamespace = new Map<string, Record<string, unknown>>();
  for (const entry of args.registry.actions()) {
    const members = byNamespace.get(entry.namespace) ?? {};
    place({ members, path: entry.name, action: entry.action, ctx: args.ctx });
    byNamespace.set(entry.namespace, members);
  }
  for (const [namespace, members] of byNamespace) {
    args.scope.set(namespace, namespaceValue(members));
  }
}

/** `jwt.decode` nests: `{ jwt: { decode: fn } }`, so the dotted call reads naturally. */
function place(args: {
  members: Record<string, unknown>;
  path: string;
  action: ActionDefinition;
  ctx: ActionContext;
}): void {
  const parts = args.path.split(".");
  const leaf = parts.pop();
  if (!leaf) return;
  let level = args.members;
  for (const part of parts) {
    level[part] = (level[part] as Record<string, unknown>) ?? {};
    level = level[part] as Record<string, unknown>;
  }
  level[leaf] = verb(args.action, args.ctx);
}

function verb(action: ActionDefinition, ctx: ActionContext): unknown {
  return nativeFn((values) => action.run(ctx, { args: values, params: params(action) }));
}

/** No options map in expression position, so let the schema supply its defaults. */
function params(action: ActionDefinition): unknown {
  if (!action.params) return {};
  try {
    return action.params.parse({});
  } catch {
    return {};
  }
}
