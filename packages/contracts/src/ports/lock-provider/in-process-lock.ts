import type { LockProvider, Release } from "./lock-provider.types.js";

/**
 * The real one: a chained-promise mutex per name. Waiters are served in the
 * order they asked, and the chain lives only in this process.
 */
export function createInProcessLock(): LockProvider {
  const tails = new Map<string, Promise<void>>();
  return {
    acquire: (name) => acquire(tails, name),
  };
}

async function acquire(tails: Map<string, Promise<void>>, name: string): Promise<Release> {
  const previous = tails.get(name) ?? Promise.resolve();
  let release: Release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  tails.set(
    name,
    previous.then(() => held),
  );
  await previous;
  return release;
}
