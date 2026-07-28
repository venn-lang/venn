/** One variable declared in `venn.toml`, with what each environment sets it to. */
export interface EnvVar {
  name: string;
  /** The comment written above the key in `venn.toml`. */
  doc?: string;
  /** True when the name reads like a credential, so its value is never shown. */
  secret: boolean;
  values: { environment: string; value: string }[];
}
