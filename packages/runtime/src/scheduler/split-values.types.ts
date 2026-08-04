/** A call's values, split into what the verb takes and what configures it. */
export interface SplitValues {
  readonly args: readonly unknown[];
  readonly opts: Record<string, unknown> | undefined;
}

/** Which verb ran, for the events a reporter reads. */
export interface VerbName {
  readonly namespace: string;
  readonly action: string;
}
