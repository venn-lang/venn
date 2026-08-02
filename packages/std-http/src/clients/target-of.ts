/** The part of a URL a failure names: where the request was trying to reach. */
export interface Target {
  /** Host and port together, with the scheme's default port spelled out. */
  authority: string;
  host: string;
  port: string;
}

const DEFAULT_PORT: Readonly<Record<string, string>> = { "https:": "443", "http:": "80" };

/**
 * Where a request was headed, as a failure spells it.
 *
 * The default port is written out rather than left implicit, because "nothing
 * is listening on api.test" reads as a question about the machine while
 * "nothing is listening on api.test:443" reads as the question it is.
 *
 * @param url The URL the request was sent to.
 * @returns The {@link Target}. A URL that will not parse is its own authority,
 * since a failure that names it is still more use than one that names nothing.
 */
export function targetOf(url: string): Target {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port || (DEFAULT_PORT[parsed.protocol] ?? "");
    return { authority: port ? `${host}:${port}` : host, host, port };
  } catch {
    return { authority: url, host: url, port: "" };
  }
}
