/** Releases a held lock. Calling it more than once is a no-op. */
export type Release = () => void;

/** Named mutexes: the semantics behind `@lock` and `@serial`. */
export interface LockProvider {
  /** Resolves once the lock named `name` is held by this caller alone. */
  acquire(name: string): Promise<Release>;
}
