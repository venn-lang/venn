/** One step of a {@link RunPlan}. */
export interface PlannedStep {
  title: string;
}

/** One flow of a {@link RunPlan}, with the steps it will take. */
export interface PlannedFlow {
  title: string;
  steps: PlannedStep[];
}

/**
 * What the run intends to do, carried on `run.started`. The UI draws it in
 * grey before anything executes, so the shape of the run is visible up front.
 */
export interface RunPlan {
  flows: PlannedFlow[];
}
