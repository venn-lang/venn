/**
 * What to write instead, when the pure body that cannot reach the world is a
 * lambda rather than a `fn` somebody declared.
 *
 * The head of the refusal is the same either way and belongs to
 * `pureBodyCannotCall`: a `fn` is pure, so it cannot call this. The way out is
 * not. A declared `fn` can be turned into a `fragment` or its call lifted to the
 * top level of a file, and that is what the sentence has always said. A lambda
 * can be neither, and `[1, 2].map(fn (n) => fs.exists("x"))` was told to move to
 * the top level of a file while already being at the top level of one.
 *
 * Nothing here mentions throwing the results away. A lambda body is one
 * expression, so the value is always kept by whatever called the method, and a
 * bare `forEach n in ns { … }` would lose it. The sentence offers to keep it and
 * a reader who does not want to may take the `forEach` out of the middle of it.
 */

/**
 * The way out of a verb written in a lambda: a loop that keeps what it answers.
 *
 * The `…` stands for the call as it was written rather than a reconstruction of
 * it, because the verb's arity is not known here and a suggestion that does not
 * run is worse than none. Same shape `helpAboutNothing` uses for `?? …`.
 *
 * The head is shared with VN5010, which says it at parse time about a lambda
 * body that is a statement rather than a value. Neither can reach the other's
 * input: that one needs the parse to have failed and this one needs it to have
 * succeeded, so the two illustrations differ without ever meeting.
 *
 * Both spellings run clean, checked from source and against the built CLI.
 */
export const IN_A_STATEMENT =
  "A verb needs a statement of its own. To keep what it answers, write `let xs = []` and then `forEach n in ns { xs = xs.push(…) }`.";
