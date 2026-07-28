import { type TypeSpec, t } from "@venn/types";

/**
 * The types `@venn/notify` publishes to the checker, under the `notify`
 * namespace. Kept as data, and mirroring `NotifyReceipt` in
 * `port/notifier.types.ts` by hand, so a generator reading the emitted `.d.ts`
 * can replace this file unnoticed. The name drops its prefix on the way in
 * because the namespace already says `notify`.
 */
export const notifyTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /**
   * What the notifier answers with once a message is on its way. `delivered`
   * reports the dispatch, not the reading: nobody here knows whether it was seen.
   */
  Receipt: t.record({ delivered: t.bool, id: t.string }),
};
