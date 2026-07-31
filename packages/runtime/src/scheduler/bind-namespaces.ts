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
  /** What the file called each namespace. Absent means every one, by its own name. */
  named?: ReadonlyMap<string, string>;
}): void {
  const byNamespace = new Map<string, Record<string, unknown>>();
  for (const entry of args.registry.actions()) {
    const members = byNamespace.get(entry.namespace) ?? {};
    place({ members, path: entry.name, action: entry.action, ctx: args.ctx });
    byNamespace.set(entry.namespace, members);
  }
  for (const [namespace, members] of byNamespace) {
    for (const local of localNames(namespace, args.named)) {
      args.scope.set(local, namespaceValue(members));
    }
  }
}

/**
 * The names this namespace answers to here: its own, plus whatever the file
 * called it.
 *
 * Its own stays because this scope is not where the rule lives. Whether a file
 * may write a namespace it never imported is the checker's answer, given before
 * anything runs and with the line in hand; binding fewer names here would only
 * turn that answer into `undefined is not a function` further along.
 */
function localNames(namespace: string, named: ReadonlyMap<string, string> | undefined): string[] {
  const local = [...(named ?? [])].filter(([, real]) => real === namespace).map(([name]) => name);
  return local.includes(namespace) ? local : [namespace, ...local];
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
