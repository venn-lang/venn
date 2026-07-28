/**
 * What a project is: its root, its members, and where its build goes.
 *
 * Every path here is text and every byte comes through the `FileSystem` port,
 * so this package imports no `node:*` and the editor reads a workspace exactly
 * the way the CLI does.
 */

export type { BuildTarget, Dependency, Manifest, PackageInfo, Profile } from "@venn-lang/contracts";
export {
  conventionalTargets,
  findProject,
  loadPackage,
  MANIFEST_FILE,
  readManifest,
} from "./discover/index.js";
export { expandMembers, matchesMember } from "./glob/index.js";
export type {
  FoundProject,
  Package,
  Project,
  ProjectProblem,
} from "./model/project.types.js";
export {
  type Drift,
  describeDrift,
  hashPackage,
  isSafeSpec,
  LOCK_FILE,
  LOCK_VERSION,
  type LockedPackage,
  type Lockfile,
  type ManagerCommand,
  managerCommand,
  type ProxiedVerb,
  packageJsonFor,
  readInstalled,
  readLockfile,
  verifyLock,
  writeLockfile,
} from "./npm/index.js";
export {
  ancestors,
  baseName,
  isInside,
  join,
  normalise,
  parentOf,
  reanchor,
  relativeTo,
} from "./paths/index.js";
export type { ScaffoldFile, ScaffoldKind, ScaffoldRequest } from "./scaffold/index.js";
export { scaffold } from "./scaffold/index.js";
export {
  type BuildRecord,
  type BuiltTarget,
  modulesDir,
  nativeModulesDir,
  outputDir,
  type ProfileName,
  RECORD_FILE,
  TARGET_DIR,
  TARGET_LAYOUT,
  targetDir,
  writeBuildRecord,
} from "./target/index.js";
export { inherit, memberDirs } from "./workspace/index.js";
