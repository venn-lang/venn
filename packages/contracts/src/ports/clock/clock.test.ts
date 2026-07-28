import { clockConformance } from "./clock.suite.js";
import { createSystemClock } from "./system-clock.js";
import { createVirtualClock } from "./virtual-clock.js";

clockConformance({ name: "system", factory: () => createSystemClock() });
clockConformance({ name: "virtual", factory: () => createVirtualClock() });
