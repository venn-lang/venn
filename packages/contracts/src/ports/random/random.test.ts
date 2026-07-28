import { createFixedRandom } from "./fixed-random.js";
import { randomConformance } from "./random.suite.js";
import { createSeededRandom } from "./seeded-random.js";

randomConformance({ name: "seeded", factory: () => createSeededRandom({ seed: 42 }) });
randomConformance({ name: "fixed", factory: () => createFixedRandom({ value: 0.5 }) });
