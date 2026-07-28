/** Reserved by RFC 2606/6761, so a generated address never resolves to anyone real. */
export const SAFE_DOMAINS: readonly string[] = [
  "example.test",
  "example.com",
  "example.org",
  "example.net",
  "test.invalid",
];

export const TLDS: readonly string[] = ["com", "org", "net", "io", "dev", "app", "com.br"];

export const HTTP_METHODS: readonly string[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export const HTTP_STATUSES: readonly number[] = [
  200, 201, 202, 204, 301, 302, 304, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503,
];

export const MIME_TYPES: readonly string[] = [
  "application/json",
  "text/html",
  "text/plain",
  "text/csv",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/octet-stream",
];

export const USER_AGENTS: readonly string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
];

export const PROTOCOLS: readonly string[] = ["https", "http"];
