/**
 * The scope the evaluator reads from: `let`/`const`, captures, parameters.
 *
 * Actions and matchers are deliberately absent. They belong to the runtime
 * registry, which keeps the evaluator pure and free of protocol execution.
 */
export interface EvalEnv {
  lookup(name: string): unknown;
}
