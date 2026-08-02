import { describe, expect, it } from "vitest";
import { buildRequest } from "./build-request.js";

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
    expect(basic.headers?.Authorization).toBe(`Basic ${btoa("u:p")}`);
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
