import type { HttpRequest } from "../port/index.js";
import type { RequestParams } from "./request.types.js";

interface Payload {
  body?: string;
  contentType?: string;
}

export interface BuildArgs {
  method: string;
  url: unknown;
  params: RequestParams;
  baseUrl: unknown;
  signal?: AbortSignal;
}

/** Turn one action call into the request the HttpClient port sends. */
export function buildRequest(args: BuildArgs): HttpRequest {
  const payload = bodyOf(args.params);
  return {
    method: args.method,
    url: withQuery(absoluteUrl(String(args.url ?? ""), args.baseUrl), args.params.query),
    headers: headersOf(args.params, payload.contentType),
    body: payload.body,
    signal: args.signal,
  };
}

const BOUNDARY = "----vennFormBoundary";

/** A map means JSON and a string means raw, unless `encode` says otherwise. */
function bodyOf(params: RequestParams): Payload {
  if (params.body === undefined) return {};
  switch (params.encode ?? defaultEncoding(params.body)) {
    case "raw":
      return { body: String(params.body) };
    case "form":
      return { body: encode(asMap(params.body)), contentType: FORM_TYPE };
    case "multipart":
      return multipart(asMap(params.body));
    default:
      return { body: JSON.stringify(params.body), contentType: "application/json" };
  }
}

function defaultEncoding(body: unknown): string {
  return typeof body === "string" ? "raw" : "json";
}

const FORM_TYPE = "application/x-www-form-urlencoded";

function multipart(values: Record<string, string | number | boolean>): Payload {
  const parts = Object.entries(values).map(
    ([key, value]) =>
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
  );
  return {
    body: `${parts.join("")}--${BOUNDARY}--\r\n`,
    contentType: `multipart/form-data; boundary=${BOUNDARY}`,
  };
}

function asMap(body: unknown): Record<string, string | number | boolean> {
  return (body ?? {}) as Record<string, string | number | boolean>;
}

function headersOf(params: RequestParams, contentType: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.headers ?? {})) headers[key] = String(value);
  if (contentType && !hasHeader(headers, "content-type")) headers["Content-Type"] = contentType;
  const auth = authorization(params);
  if (auth && !hasHeader(headers, "authorization")) headers.Authorization = auth;
  return headers;
}

function authorization(params: RequestParams): string | undefined {
  if (params.bearer) return `Bearer ${params.bearer}`;
  if (!params.basic) return undefined;
  return `Basic ${base64(`${params.basic.user}:${params.basic.pass}`)}`;
}

function withQuery(url: string, query: RequestParams["query"]): string {
  const encoded = query ? encode(query) : "";
  if (!encoded) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${encoded}`;
}

function encode(values: Record<string, string | number | boolean>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) search.append(key, String(value));
  return search.toString();
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === name);
}

function base64(text: string): string {
  return btoa(text);
}

/** Resolve a relative path against `config.baseUrl`; absolute URLs pass through. */
function absoluteUrl(url: string, baseUrl: unknown): string {
  if (typeof baseUrl !== "string" || baseUrl === "" || hasScheme(url)) return url;
  return `${baseUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

function hasScheme(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
}
