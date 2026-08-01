// @venn-lang/core: the fixed kernel. Worker-safe, with no `node:*` (enforced by
// tsdown platform "neutral" and a tsconfig without @types/node).

export * from "./ast/index.js";
export * from "./codes/index.js";
export type { CompiledBody, Thunk } from "./compile/index.js";
export { closureOfDecl, compileExpr } from "./compile/index.js";
export * from "./events/index.js";
// Decorators: the expansion phase, run between parsing and everything else.
export * from "./expand/index.js";
export type { Cell, CellEnv, Closure, EvalEnv, NativeFn } from "./expr/index.js";
export {
  callClosure,
  childEnv,
  display,
  evaluate,
  hasCells,
  invoke,
  invoke1,
  isCallable,
  isClosure,
  isNamespaceValue,
  isNativeFn,
  memberValue,
  namespaceValue,
  nativeFn,
  PRELUDE_VALUES,
  typeName,
} from "./expr/index.js";
// Formatting: shared by `venn fmt` and the editor so both agree.
export * from "./format/index.js";
// The generated AST (Document, FlowDecl, StepDecl, ActionCall, Expr, type guards…).
export * from "./generated/ast.js";
// Langium services (for advanced hosts; the CLI/runtime use `parse`).
export {
  VennGeneratedModule,
  VennGeneratedSharedModule,
  VennLanguageMetaData,
} from "./generated/module.js";
// AST → node graph (§22).
export * from "./graph/index.js";
// `${…}` placeholders: one description, shared by the evaluator and the editor.
export * from "./interpolation/index.js";
export { createVennServices, VennLexer, vennServices } from "./lang/index.js";
export {
  handedOn,
  isPackageSpecifier,
  publishedNames,
  type SpecifierKind,
  specifierKind,
} from "./module/index.js";
export type { ParseOutput } from "./parse/index.js";
export { EXPRESSION_OFFSET, parse, parseExpression } from "./parse/index.js";
export {
  type Asked,
  answers,
  asked,
  type BindsValue,
  boundNames,
  loopBinding,
  type PatternSlot,
  type PatternTest,
  patternNames,
  patternSlots,
  patternTests,
  type Rest,
  readPath,
  type Step,
  slotValue,
} from "./pattern/index.js";
export * from "./problem/index.js";
// Static type inference (Hindley-Milner) + generics.
export {
  BUILTIN_TYPES,
  type BuiltinType,
  type CheckTypesOptions,
  type CheckTypesResult,
  checkTypes,
  createContext,
  DYNAMIC,
  type FnType,
  type ImportedTypes,
  importedTypes,
  isBuiltinType,
  isPrelude,
  KIND_SPECS,
  KIND_TYPES,
  type LiteralType,
  literal,
  MEMBER_DOCS,
  type MemberDoc,
  memberKind,
  memberType,
  type OpaqueType,
  opaque,
  PRELUDE_SPECS,
  type PreludeArg,
  type PreludeSpec,
  prune,
  type RecordType,
  type ResolveRef,
  resolveMember,
  showType,
  showTypes,
  specToType,
  type Type,
  type TypeCatalog,
  type UnionType,
  union,
} from "./typecheck/index.js";
export * from "./units/index.js";
export * from "./value/index.js";
