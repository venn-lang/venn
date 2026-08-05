import type { ActionContext } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { okResponse } from "../clients/index.js";
import type { HttpRequest } from "../port/index.js";
import { buildRequest } from "./build-request.js";
import { httpAction } from "./http-action.js";

const base = { method: "POST", url: "/token", baseUrl: "https://api.test" };

describe("buildRequest", () => {
  it("resolves a relative path against config.baseUrl", () => {
    expect(buildRequest({ ...base, params: {} }).url).toBe("https://api.test/token");
  });

  it("leaves an absolute URL alone", () => {
    const request = buildRequest({ ...base, url: "https://other.test/x", params: {} });

    expect(request.url).toBe("https://other.test/x");
  });

  it("encodes a query string, appending to one already there", () => {
    const query = { page: 2, q: "a b" };

    expect(buildRequest({ ...base, params: { query } }).url).toBe(
      "https://api.test/token?page=2&q=a+b",
    );
    expect(buildRequest({ ...base, url: "/x?y=1", params: { query } }).url).toContain(
      "?y=1&page=2",
    );
  });

  it("sends a map as JSON without being told to", () => {
    const request = buildRequest({ ...base, params: { body: { a: 1 } } });

    expect(request.body).toBe('{"a":1}');
    expect(request.headers?.["Content-Type"]).toBe("application/json");
  });

  it("passes a string body through untouched", () => {
    const request = buildRequest({ ...base, params: { body: "<xml/>" } });

    expect(request.body).toBe("<xml/>");
    expect(request.headers?.["Content-Type"]).toBeUndefined();
  });

  it("url-encodes the body when asked, the shape OAuth token endpoints want", () => {
    const request = buildRequest({
      ...base,
      params: { body: { grant_type: "password", username: "a b" }, encode: "form" },
    });

    expect(request.body).toBe("grant_type=password&username=a+b");
    expect(request.headers?.["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  it("builds a multipart body with a boundary that matches the header", () => {
    const request = buildRequest({
      ...base,
      params: { body: { field: "value" }, encode: "multipart" },
    });

    expect(request.headers?.["Content-Type"]).toContain("multipart/form-data; boundary=");
    expect(request.body).toContain('Content-Disposition: form-data; name="field"');
    expect(request.body).toContain("value");
  });

  it("sends nothing when there is no body", () => {
    expect(buildRequest({ ...base, params: {} }).body).toBeUndefined();
  });

  it("writes the Authorization header for bearer and basic", () => {
    const bearer = buildRequest({ ...base, params: { bearer: "abc" } });
    const basic = buildRequest({ ...base, params: { basic: { user: "u", pass: "p" } } });

    expect(bearer.headers?.Authorization).toBe("Bearer abc");
    expect(basic.headers?.Authorization).toBe("Basic dTpw");
  });

  /**
   * RFC 7617 §2 requires the UTF-8 bytes, and the exact header is the assertion.
   *
   * `btoa` encoded the string's code units, so `señha` went out as latin-1,
   * `dXNlcjpzZfFoYQ==`: a different password, a 401 from the far end, and nothing
   * in Venn saying why. A round trip through the same wrong encoder agrees with
   * itself, so the bytes are spelled out here. `auth.basic` is asserted against
   * the same two strings, because one encoder now answers both.
   */
  it("sends a non-ASCII credential as UTF-8, not as latin-1", () => {
    const accented = buildRequest({ ...base, params: { basic: { user: "user", pass: "señha" } } });
    const beyond = buildRequest({ ...base, params: { basic: { user: "user", pass: "パス" } } });

    expect(accented.headers?.Authorization).toBe("Basic dXNlcjpzZcOxaGE=");
    expect(beyond.headers?.Authorization).toBe("Basic dXNlcjrjg5Hjgrk=");
  });

  it("never overrides a header the caller set explicitly", () => {
    const request = buildRequest({
      ...base,
      params: {
        body: { a: 1 },
        bearer: "abc",
        headers: { "content-type": "text/plain", authorization: "Custom x" },
      },
    });

    expect(request.headers?.["content-type"]).toBe("text/plain");
    expect(request.headers?.["Content-Type"]).toBeUndefined();
    expect(request.headers?.authorization).toBe("Custom x");
  });
});

/** A context whose HttpClient records what it was handed, and answers 200. */
function capturing(sent: HttpRequest[]): ActionContext {
  return {
    config: {},
    port: () => ({
      request: (request: HttpRequest) => {
        sent.push(request);
        return Promise.resolve(okResponse());
      },
    }),
  } as unknown as ActionContext;
}

/**
 * The verb, because the builder is not what a flow calls.
 *
 * `http.get "…" { basic: … }` was verified by hand against a capturing port and
 * the wrong bytes really went out, so the capture is written down here: it holds
 * that the encoder reaches the request the client is handed, and not only the
 * function that assembles it.
 */
describe("http.get with basic credentials", () => {
  it("hands the port the RFC 7617 header", async () => {
    const sent: HttpRequest[] = [];

    await httpAction({ name: "get", method: "GET" }).run(capturing(sent), {
      args: ["https://api.test/me"],
      params: { basic: { user: "user", pass: "señha" } },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.headers?.Authorization).toBe("Basic dXNlcjpzZcOxaGE=");
  });
});
