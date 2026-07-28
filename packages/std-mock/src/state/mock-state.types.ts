/** A canned response an interceptor replies with. */
export interface MockResponse {
  status: number;
  body: unknown;
}

/** A registered interception: match a method and a path pattern, reply with `respond`. */
export interface Interceptor {
  method: string;
  path: string;
  respond: MockResponse;
}

/** A named mock service, optionally seeded from a source such as an OpenAPI file. */
export interface NamedMock {
  name: string;
  from?: string;
}

/** The in-process, mutable state the `mock` namespace reads and writes. */
export interface MockState {
  mocks: Map<string, NamedMock>;
  intercepts: Interceptor[];
  flags: Map<string, unknown>;
  /** Virtual "now" in epoch ms once frozen; `undefined` while the clock is live. */
  frozenInstant?: number;
}
