/** Structured, serializable, redaction-safe detail attached to a {@link VennError}. */
export type VennErrorDetail = Readonly<Record<string, unknown>>;

/**
 * The single error type that crosses a contracts boundary.
 *
 * Every failure carries a stable `VNxxxx` code, so conformance suites assert on
 * `.code` and never on prose. Messages stay free to improve.
 */
export class VennError extends Error {
  readonly code: string;
  readonly detail: VennErrorDetail | undefined;

  constructor(args: { code: string; message: string; detail?: VennErrorDetail }) {
    super(args.message);
    this.name = "VennError";
    this.code = args.code;
    this.detail = args.detail;
  }
}
