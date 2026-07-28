import type { FnSpec, RecordSpec, TypeSpec } from "./type-spec.types.js";

/**
 * A published type as one line of text.
 *
 * Reads the wire format directly rather than going through the checker. Nothing
 * has to be resolved, so a `ref` shows as the name a plugin published
 * (`http.Server`, not the record behind it), and a package with no compiler in
 * it can still say what it takes.
 *
 * @param spec the type to render
 * @returns one line; a record past four fields is elided rather than wrapped
 */
export function showSpec(spec: TypeSpec): string {
  switch (spec.kind) {
    case "prim":
      return spec.name;
    case "literal":
      return typeof spec.value === "string" ? `"${spec.value}"` : String(spec.value);
    case "list":
      return `list<${showSpec(spec.element)}>`;
    case "map":
      return `map<${showSpec(spec.value)}>`;
    case "record":
      return showRecord(spec);
    case "fn":
      return showFn(spec);
    case "union":
      return spec.members.map(showSpec).join(" | ");
    case "opaque":
    case "ref":
      return spec.name;
    default:
      return "dynamic";
  }
}

function showFn(spec: FnSpec): string {
  return `fn(${spec.params.map(showSpec).join(", ")}) -> ${showSpec(spec.result)}`;
}

/** Past a few fields a shape stops informing and starts filling the line. */
const SHOWN_FIELDS = 4;

function showRecord(spec: RecordSpec): string {
  const names = Object.keys(spec.fields);
  if (names.length === 0) return "{}";
  const shown = names.slice(0, SHOWN_FIELDS).map((name) => field(spec, name));
  const rest = names.length > shown.length ? `, …${names.length - shown.length} more` : "";
  return `{ ${shown.join(", ")}${rest} }`;
}

function field(spec: RecordSpec, name: string): string {
  const type = spec.fields[name];
  return `${name}: ${type ? showSpec(type) : "dynamic"}`;
}
