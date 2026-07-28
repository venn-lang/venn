import { type TypeSpec, t } from "@venn-lang/types";

/**
 * The types the plugin publishes to flows, as `ws.Message`.
 *
 * Mirrors `Message` in `message.types.ts` and the Zod schema beside it: the
 * schema guards a value at runtime, this tells the checker what `ws.expect`
 * handed back. Open, because `expect { where: … }` matches on whatever fields a
 * message carries beyond `type` and `data`.
 */
export const wsTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /** One message off the socket, as `ws.expect` gives it back. */
  Message: t.record(
    { type: t.string, data: t.dynamic },
    { optional: ["type", "data"], open: true },
  ),
};
