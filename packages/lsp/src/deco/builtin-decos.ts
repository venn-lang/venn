import type { DecoratorDefinition } from "@venn/core";
import { builtinDecorators } from "@venn/runtime";
import { decoratorDoc } from "./builtin-docs.js";
import type { DecoInfo } from "./deco.types.js";
import { kindOf } from "./kind-of.js";

/**
 * `@doc` is written like a decorator and read like one, but expansion never
 * sees it: it is where a declaration's documentation lives when no `##` block
 * does, and the editor is what reads it.
 */
const DOC: DecoInfo = {
  name: "doc",
  decorates: [],
  signature: "@doc(text)",
  doc: decoratorDoc("doc"),
};

/**
 * The decorators every file has without asking: the ones the runtime ships.
 * They are read through the same shape a declared `deco` produces, so the
 * editor holds one notion of what a decorator is rather than two.
 */
export function builtinDecos(): DecoInfo[] {
  return [...builtinDecorators.map(fromDefinition), DOC];
}

function fromDefinition(decorator: DecoratorDefinition): DecoInfo {
  return {
    name: decorator.name,
    decorates: (decorator.targets ?? []).map(kindOf),
    signature: `@${decorator.name}`,
    doc: decoratorDoc(decorator.name) ?? decorator.doc,
  };
}
