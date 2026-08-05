// @venn-lang/core: the fixed kernel. Worker-safe, with no `node:*` (enforced by
// tsdown platform "neutral" and a tsconfig without @types/node).

export * from "./ast/index.js";
export * from "./codes/index.js";
export type { CompiledBody, StopCheck, Thunk } from "./compile/index.js";
export { closureOfDecl, compileExpr, pureBodyCannotCall, setStopCheck } from "./compile/index.js";
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
  indexValue,
  invoke,
  invoke1,
  isCallable,
  isClosure,
  isNamespaceValue,
  isNativeFn,
  MEMBER_NAMES,
  memberValue,
  namespaceValue,
  nativeFn,
  PRELUDE_VALUES,
  typeName,
} from "./expr/index.js";
// What a `fail` raises, shared by the compiler and the scheduler so a caught
// failure reads the same wherever the `fail` was written.
export * from "./fail/index.js";
// Formatting: shared by `venn fmt` and the editor so both agree.
export * from "./format/index.js";
// A closure written above the binding it reads, refused where it is written.
export type { ForwardRead } from "./forward-read/index.js";
export {
  boundBelow,
  forwardReadProblems,
  forwardReads,
  readBeforeBound,
  refuseForwardReads,
} from "./forward-read/index.js";
// The generated AST (Document, FlowDecl, StepDecl, ActionCall, Expr, type guards…).
export * from "./generated/ast.js";
// Langium services (for advanced hosts; the CLI/runtime use `parse`).
export {
  VennGeneratedModule,
  VennGeneratedSharedModule,
  VennLanguageMetaData,
} from "./generated/module.js";
// `${…}` placeholders: one description, shared by the evaluator and the editor.
export * from "./interpolation/index.js";
export { createVennServices, VennLexer, vennServices } from "./lang/index.js";
export {
  handedOn,
  isPackageSpecifier,
  MODULE_FILE,
  moduleFileOf,
  publishedNames,
  type SpecifierKind,
  specifierKind,
} from "./module/index.js";
export type { ParseOutput } from "./parse/index.js";
export {
  EXPRESSION_OFFSET,
  fileOf,
  KEYWORDS,
  parse,
  parseExpression,
  parseProblems,
} from "./parse/index.js";
export {
  type Asked,
  answers,
  asked,
  type BindsValue,
  boundNames,
  loopBinding,
  type PatternSlot,
  type PatternTest,
  patternMisfit,
  patternNames,
  patternSlots,
  patternTests,
  type Rest,
  readPath,
  type Step,
  slotValue,
} from "./pattern/index.js";
export { stepTitlesOf } from "./plan/index.js";
export * from "./problem/index.js";
// Where a node is: one answer, `${…}` included.
export * from "./span/index.js";
// "Did you mean": one answer, so six checkers cannot disagree about one typo.
export * from "./suggest/index.js";
// Static type inference (Hindley-Milner) + generics.
export {
  BUILTIN_TYPES,
  type BuiltinType,
  type CheckTypesOptions,
  type CheckTypesResult,
  checkTypes,
  createContext,
  DYNAMIC,
  type ExactType,
  type FnType,
  type ImportedTypes,
  importedTypes,
  isBuiltinType,
  isPrelude,
  KIND_SPECS,
  KIND_TYPES,
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
