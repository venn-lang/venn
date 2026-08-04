/**
 * The `VNxxxx` codes the runtime raises that the kernel's catalogue does not
 * hold, because the kernel does not know they exist.
 *
 * A code written where it is thrown is a code nobody can find. These are here
 * so the list of what a run can produce is one place, and so a test can hold
 * that no code is raised without being declared.
 */
export const RUN_CODES = {
  /** `fail "…"` with no code of its own, which is a program refusing itself. */
  VN6002_FAILED: "VN6002",
  /** A caught error that carried no code of its own. */
  VN7000_UNKNOWN: "VN7000",
  /** A port nothing was bound to. */
  VN7002_UNBOUND_PORT: "VN7002",
  /** A step or a flow that ran out of the time it was given. */
  VN8001_TIMED_OUT: "VN8001",
  /** Work that was cancelled, was given a while to stop, and did not stop. */
  VN8002_STILL_RUNNING: "VN8002",
  /** Deeper than the machine will go: a function that never stops calling itself. */
  VN8003_TOO_DEEP: "VN8003",
} as const;
