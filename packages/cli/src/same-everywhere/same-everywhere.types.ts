/**
 * What the corpus is made of: a body, the places it is written, and what each
 * of those places answered.
 */

/** Where a body is written. Each is one wrapper around the same lines. */
export type Placement = "top" | "fnDecl" | "fnExpr" | "fragment";

/** One case: the lines under test, and what its header claims about them. */
export interface Case {
  /** The file name without `.vn`, which is what names it in a failure. */
  readonly name: string;
  /** The statements under test, exactly as written. */
  readonly body: string;
  /**
   * Placements this body is not legal in, each with the reason.
   *
   * A fact about the language, not about today's behaviour, which is why it is
   * written by hand and has to carry why: `break` is a statement a `fn` may hold
   * and a file may not.
   */
  readonly excludes: ReadonlyMap<Placement, string>;
  /**
   * Placements this body is meant to answer differently in, each with the
   * reason. Everything not listed here has to answer the same everywhere.
   */
  readonly differs: ReadonlyMap<Placement, string>;
  /**
   * Placements that answer differently, are known to be wrong to, and carry the
   * issue that says so.
   *
   * Apart from `differs` because the two are opposites: one is the language
   * having a rule, the other is the language not keeping one. A corpus with no
   * word for the second either goes red on a defect nobody is fixing today or,
   * worse, files that defect under "meant to".
   */
  readonly open: ReadonlyMap<Placement, string>;
}

/** One placement's file, and the half-open range the body occupies in it. */
export interface Placed {
  readonly source: string;
  readonly from: number;
  readonly to: number;
}

/** A refusal, in the parts that survive being raised from two different paths. */
export interface Refusal {
  /** Empty for a host error, which is itself the thing worth seeing. */
  readonly code: string;
  readonly title: string;
  readonly help: string | null;
  /**
   * The file the refusal points at. Recorded because a body the compiler built
   * and a body the scheduler walked have to name the same place, and an empty
   * uri is one the reporter prints with no location at all.
   */
  readonly uri: string;
  readonly column: number;
}

/** What one placement of one body did, in every channel a user can see. */
export interface Answer {
  /** Every problem the front end found, as `CODE severity@column title`. */
  readonly problems: readonly string[];
  /** What the body left in `seen`. `null` when the run never printed it. */
  readonly out: string | null;
  /** What running it raised, or `null` when it ran through. */
  readonly refused: Refusal | null;
}

/** Every placement's answer for one case, by placement name. */
export type Answers = Readonly<Record<string, Answer>>;

/** The pinned answers on disk, by case name. */
export type Pinned = Readonly<Record<string, Answers>>;

/** What drives one source through every pass and then through the program. */
export interface Driver {
  /** Analyse and run one whole file, and answer with everything it did. */
  answer(source: string): Promise<Answer>;
}
