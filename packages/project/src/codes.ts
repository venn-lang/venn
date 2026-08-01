/**
 * The `VNxxxx` codes the project tooling raises.
 *
 * `VN21xx` is the workspace's own range inside the name-resolution family: what
 * is wrong is which project a path belongs to, which package a name means, or
 * whether what is installed matches what was locked.
 *
 * Most are printed by the CLI inside a sentence rather than raised as a value,
 * and are declared here anyway: a code is worth having in one list whether it
 * arrives as a `Problem` or as a line on stderr.
 */
export const PROJECT_CODES = {
  VN2101_NO_PROJECT: "VN2101",
  VN2102_ALREADY_A_PROJECT: "VN2102",
  VN2103_NO_SUCH_PACKAGE: "VN2103",
  VN2104_NOTHING_TO_ADD_TO: "VN2104",
  VN2105_NOT_A_PACKAGE_NAME: "VN2105",
  VN2106_NO_LOCK: "VN2106",
  VN2107_LOCK_DISAGREES: "VN2107",
} as const;
