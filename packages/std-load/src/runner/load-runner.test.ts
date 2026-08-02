import { VennError } from "@venn-lang/contracts";
import { expect, it } from "vitest";
import { constantProfile } from "../profiles/index.js";
import { createFakeLoadRunner } from "./fake-runner.js";
import { loadRunnerConformance } from "./load-runner.suite.js";
import { createRealLoadRunner } from "./real-runner.js";

loadRunnerConformance({ name: "fake", make: () => createFakeLoadRunner() });

it("the real runner rejects, not implemented in this build (VN8090)", async () => {
  const make = () => createRealLoadRunner().run(constantProfile({ vus: 1 }));
  await expect(make()).rejects.toBeInstanceOf(VennError);
  await expect(make()).rejects.toMatchObject({ code: "VN8090" });
});
