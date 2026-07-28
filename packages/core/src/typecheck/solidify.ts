import { list, type RecordType, record, type Type, union } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * The same type with every variable resolved, or nothing if any is still open.
 *
 * A type solved during one pass carries variables belonging to that pass's
 * context; handing one to the next pass would smuggle in a variable nobody owns.
 * Only a fully settled type crosses, so `undefined` here is an answer rather
 * than a failure.
 */
export function solidify(type: Type): Type | undefined {
  const t = prune(type);
  switch (t.kind) {
    case "var":
      return undefined;
    case "list":
      return map1(solidify(t.element), list);
    case "union":
      return all(t.members)?.length ? union(all(t.members) as Type[]) : undefined;
    case "record":
      return solidRecord(t);
    case "fn":
      return solidFn(t.params, t.result, t);
    default:
      return t;
  }
}

function map1(inner: Type | undefined, wrap: (type: Type) => Type): Type | undefined {
  return inner ? wrap(inner) : undefined;
}

function all(types: readonly Type[]): Type[] | undefined {
  const solid = types.map(solidify);
  return solid.some((type) => type === undefined) ? undefined : (solid as Type[]);
}

function solidRecord(type: RecordType): Type | undefined {
  const out = new Map<string, Type>();
  for (const [name, field] of type.fields) {
    const solid = solidify(field);
    if (!solid) return undefined;
    out.set(name, solid);
  }
  const rest = type.rest ? solidify(type.rest) : undefined;
  if (type.rest && !rest) return undefined;
  return record(out, type.open, rest);
}

function solidFn(
  params: readonly Type[],
  result: Type,
  shape: { variadic?: boolean; ignorableFrom?: number },
): Type | undefined {
  const solidParams = all(params);
  const solidResult = solidify(result);
  if (!solidParams || !solidResult) return undefined;
  return { kind: "fn", params: solidParams, result: solidResult, ...shape };
}
