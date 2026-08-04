import { namespaceValue, nativeFn } from "@venn-lang/core";
import type { ActionDefinition } from "@venn-lang/sdk";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import type { VerbName } from "./split-values.types.js";
import { runVerbValue } from "./verb-value.js";

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
  engine: Engine;
  scope: Scope;
  /** What the file called each namespace. Absent means every one, by its own name. */
  named?: ReadonlyMap<string, string>;
}): void {
  const byNamespace = new Map<string, Record<string, unknown>>();
  for (const entry of args.engine.registry.actions()) {
    const members = byNamespace.get(entry.namespace) ?? {};
    const name = { namespace: entry.namespace, action: entry.name };
    place({ members, path: entry.name, action: entry.action, name, engine: args.engine });
    byNamespace.set(entry.namespace, members);
  }
  // A constant is placed the same way a verb is, so `math.pi` and `math.sin(x)`
  // are read off one object and nothing downstream has to know the difference.
  for (const { namespace, value } of args.engine.registry.values()) {
    const members = byNamespace.get(namespace) ?? {};
    members[value.name] = value.value;
    byNamespace.set(namespace, members);
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
  name: VerbName;
  engine: Engine;
}): void {
  const parts = args.path.split(".");
  const leaf = parts.pop();
  if (!leaf) return;
  let level = args.members;
  for (const part of parts) {
    level[part] = (level[part] as Record<string, unknown>) ?? {};
    level = level[part] as Record<string, unknown>;
  }
  level[leaf] = verb(args);
}

/**
 * One verb as a value.
 *
 * Everything a call means is settled by `runVerbValue`, which is what the
 * statement form settles too. This used to decide it here and differently: the
 * trailing map was passed on as an argument and the options came from
 * `params.parse({})`, so `crypto.hash("x", { algorithm: "sha512" })` inside a
 * `print` hashed with sha256 and said nothing.
 */
function verb(args: { action: ActionDefinition; name: VerbName; engine: Engine }): unknown {
  return nativeFn((values) => runVerbValue({ ...args, values }));
}
