export { acceptedKinds, decoTarget } from "./accepted-kinds.js";
export type {
  DecoBodyArgs,
  DecoSignature,
  DocumentDecoArgs,
  ImportedDeco,
  NameRead,
  SignatureResult,
} from "./deco/index.js";
export {
  decoCannotCall,
  decoDecorator,
  namesBound,
  namesOutOfReach,
  namesRead,
  readSignature,
  withDocumentDecos,
} from "./deco/index.js";
export { decorateCallable } from "./decorate-callable.js";
export type { Decorations } from "./decorations.js";
export { AROUND_KEYS, addDecoration, readDecorations } from "./decorations.js";
export { expand } from "./expand.js";
export type {
  DecoratedNode,
  DecoratorDefinition,
  DecoratorSource,
  ExpandContext,
  ExpandResult,
  NodeMeta,
} from "./expand.types.js";
export type { HandleSurface, TargetHandle, TargetKind } from "./handles/index.js";
export {
  handleSurface,
  isTargetKind,
  makeHandle,
  TARGET_KINDS,
  targetKindOf,
  verbsOfKind,
} from "./handles/index.js";
export { metaOf, readMeta, writeMeta } from "./node-meta.js";
export { swapNode } from "./swap-node.js";
export {
  everyKindWritten,
  kindWords,
  nodeWord,
  wrongKind,
  wrongKindTitle,
  wrongPlace,
  wrongTargetTitle,
} from "./wrong-kind.js";
