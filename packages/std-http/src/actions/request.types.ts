/** A value that may appear in a header, a query string or a form field. */
export type Scalar = string | number | boolean;

/** How `body` is put on the wire. */
export type Encoding = "json" | "form" | "multipart" | "raw";

/**
 * Everything a request may carry. One map keeps the call site flat:
 * `http.post "/token" { body: { … }, encode: "form", bearer: token }`.
 *
 * There is a single payload key, `body`, as `fetch` and `axios` have. Separate
 * `json:` and `form:` keys would make one idea look like two; the wire format is
 * {@link Encoding}'s job instead.
 */
export interface RequestParams {
  /** Extra headers. Anything set here wins over what Venn would infer. */
  headers?: Record<string, Scalar>;
  /** Appended as a query string, encoded for you. */
  query?: Record<string, Scalar>;
  /** What to send. A map becomes JSON; a string is sent as written. */
  body?: unknown;
  /** Override the serialisation of {@link body}. */
  encode?: Encoding;
  /** Shorthand for `Authorization: Bearer …`. */
  bearer?: string;
  /** Shorthand for HTTP basic auth. */
  basic?: { user: string; pass: string };
}
