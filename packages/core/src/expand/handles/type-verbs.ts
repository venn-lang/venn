import { nativeFn } from "../../expr/index.js";
import type { FieldDecl, TypeBody, TypeDecl, TypeRef } from "../../generated/ast.js";
import type { VerbTable } from "./handle.types.js";
import { verbRefusal } from "./missing-verb.js";

/** The fields of a `type { … }`, and the two ways to change the set. */
export const TYPE_VERBS: VerbTable = {
  props: { fields: (node) => (bodyOf(node as TypeDecl)?.fields ?? []).map((one) => one.name) },
  calls: {
    addField: (node) =>
      nativeFn((args) => addField(node as TypeDecl, String(args[0]), String(args[1] ?? "string"))),
    removeField: (node) => nativeFn((args) => removeField(node as TypeDecl, String(args[0]))),
  },
};

function bodyOf(decl: TypeDecl): TypeBody | undefined {
  return decl.body;
}

/** `type Id = string` has no fields to change, and says so rather than growing one. */
function requireBody(decl: TypeDecl, verb: string): TypeBody {
  const body = bodyOf(decl);
  if (body) return body;
  throw verbRefusal(`\`${decl.name}\` is an alias, so \`${verb}\` has no fields to change.`);
}

function addField(decl: TypeDecl, name: string, type: string): null {
  const body = requireBody(decl, "addField");
  if (body.fields.some((field) => field.name === name)) return null;
  body.fields.push(field({ body, name, type }));
  return null;
}

function removeField(decl: TypeDecl, name: string): null {
  const body = requireBody(decl, "removeField");
  body.fields = body.fields.filter((one) => one.name !== name);
  return null;
}

function field(args: { body: TypeBody; name: string; type: string }): FieldDecl {
  return {
    $type: "FieldDecl",
    $container: args.body,
    $containerProperty: "fields",
    annotations: [],
    name: args.name,
    optional: false,
    fieldType: typeRef(args.type),
  } as unknown as FieldDecl;
}

function typeRef(name: string): TypeRef {
  const ref = { $type: "TypeRef", members: [] } as unknown as TypeRef;
  ref.members.push({ $type: "NamedType", $container: ref, name, args: [] } as unknown as never);
  return ref;
}
