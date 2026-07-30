import type { BenchCase } from "../bench.types.ts";
import { branchCount, counter, fib, loop, pipeline, records, reduceSum, strings } from "./twins.ts";

/**
 * Every workload, sized so one repetition takes tens of milliseconds on the
 * Venn side — long enough that the clock's resolution does not matter, short
 * enough that the whole suite finishes in under a minute.
 */
export const CASES: readonly BenchCase[] = [
  {
    name: "fib(25)",
    stresses: "function calls, recursion",
    vn: "fib.vn",
    ts: () => fib(25),
    reps: 9,
    warmup: 6,
  },
  {
    name: "reduce 50k",
    stresses: "one closure call per element",
    vn: "reduce.vn",
    ts: reduceSum,
    reps: 9,
    warmup: 6,
  },
  {
    name: "branch 50k",
    stresses: "conditional + arithmetic per element",
    vn: "branch.vn",
    ts: branchCount,
    reps: 9,
    warmup: 6,
  },
  {
    name: "pipeline 5k",
    stresses: "filter / sort / group via native methods",
    vn: "pipeline.vn",
    ts: pipeline,
    reps: 9,
    warmup: 6,
  },
  {
    name: "loop 50k",
    stresses: "forEach: a statement executed per item",
    vn: "loop.vn",
    ts: loop,
    reps: 9,
    warmup: 6,
  },
  {
    name: "counter 50k",
    stresses: "loop carrying state, against a while with assignment",
    vn: "counter.vn",
    ts: counter,
    reps: 9,
    warmup: 6,
  },
  {
    name: "records 20k",
    stresses: "building maps, reading fields",
    vn: "records.vn",
    ts: records,
    reps: 9,
    warmup: 6,
  },
  {
    name: "strings 10k",
    stresses: "string interpolation (20k placeholders)",
    vn: "strings.vn",
    ts: strings,
    reps: 9,
    warmup: 6,
  },
];
