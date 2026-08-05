export { defaultManifest } from "./default-manifest.js";
export {
  addDependency,
  DEPENDENCIES,
  type DependencyEdit,
  removeDependency,
} from "./edit/index.js";
export type { FormatSettings, Manifest, ManifestProvider } from "./manifest.types.js";
export { createMemoryManifest } from "./memory-manifest.js";
export type {
  BuildTarget,
  Dependency,
  PackageInfo,
  PackageManagerName,
  Profile,
  TargetKind,
  ToolingSettings,
  WorkspaceSettings,
} from "./project.types.js";
export {
  BIN_DIR,
  DEFAULT_PROFILES,
  LIB_ROOT,
  MAIN_ROOT,
  readInheritable,
} from "./read/index.js";
export { type AliasTarget, resolveAlias } from "./resolve-alias.js";
export { strayManifestKeys } from "./stray-keys.js";
export type { StrayKey } from "./stray-keys.types.js";
export { parseToml } from "./toml/index.js";
export { tomlDocs } from "./toml-docs.js";
export { createTomlManifest } from "./toml-manifest.js";
