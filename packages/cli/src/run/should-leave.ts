/**
 * Whether the process should go now, or hand the decision to the event loop.
 *
 * The distinction the exit code alone cannot carry: `exit 0` and "ran off the
 * end" both arrive as zero, and only one of them is a request to stop. A
 * program that merely finished its last line may still be serving; one that
 * asked to leave, or that ended badly, is done either way.
 */
export function shouldLeave(args: { code: number; requested: boolean }): boolean {
  return args.requested || args.code !== 0;
}
