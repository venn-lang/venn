import { type TypeSpec, t } from "@venn-lang/types";

/**
 * The types `@venn-lang/mock` publishes: `mock.Mock`, `mock.Interceptor` and
 * `mock.Response`.
 *
 * They mirror `state/mock-state.types.ts` by hand, dropping the prefix the
 * namespace already supplies (`NamedMock` becomes `Mock`). Change one side and
 * the other has to follow.
 */
export const mockTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /** A registered mock service. `from` names what it was seeded from. */
  Mock: t.record({ name: t.string, from: t.string }, { optional: ["from"] }),
  /** One registered interception: what to match, and what to answer with. */
  Interceptor: t.record({
    method: t.string,
    path: t.string,
    respond: t.ref("mock.Response"),
  }),
  /** A canned reply. The body is whatever the flow put there. */
  Response: t.record({ status: t.number, body: t.dynamic }),
};
