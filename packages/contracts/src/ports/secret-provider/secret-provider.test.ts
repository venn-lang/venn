import { createEnvSecrets } from "./env-secrets.js";
import { createMemorySecrets } from "./memory-secrets.js";
import { secretProviderConformance } from "./secret-provider.suite.js";

secretProviderConformance({
  name: "memory",
  known: { name: "pw", raw: "s3cr3t" },
  factory: () => createMemorySecrets({ values: { pw: "s3cr3t" } }),
});

secretProviderConformance({
  name: "env",
  known: { name: "VENN_TEST_PW", raw: "envpass" },
  factory: () => {
    process.env.VENN_TEST_PW = "envpass";
    return createEnvSecrets();
  },
});
