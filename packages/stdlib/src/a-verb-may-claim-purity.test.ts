import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";
import { EACH_PLUGIN, reachOf } from "./port-reach.js";

/**
 * The verbs that override their plugin's capability, and what each one computes.
 *
 * A capability is declared per plugin while purity is a property of each verb, so a
 * namespace holding both loses its pure half: `date.now` reads the clock and
 * `date.format` writes out a moment it was handed, from one namespace. Refusing the
 * second refuses a correct program, and `examples/programs/standup/rota/schedule.vn`
 * had no pure path at all, so the coarse answer would have had a working module
 * rewritten into `fragment`s to satisfy a rule about effects it does not have.
 *
 * `pure` is the exception, not the rule. Absent inherits the plugin, which keeps the
 * default safe. But an over-claimed `pure` is worse than an under-declared
 * `requires`: the second admits a verb by omission, the first admits one
 * deliberately, at the moment its author was most confident. `requires` was trusted
 * and was silently wrong in four plugins, and the control that failed there was a
 * docblock in `std-date` already saying "a capability belongs to a plugin and purity
 * belongs to a verb" while `mathPlugin` quietly said otherwise. Comments and care did
 * not hold it, so this is checked.
 *
 * Written down so annotating a verb is a visible act rather than a field somebody
 * added in passing. Every name here was read before it was annotated: the `math`
 * entries take numbers and give numbers back through `answered`, ignoring their
 * context; the three `date` entries are handed the moment they work on, default their
 * zone to UTC rather than to the machine's, and build from `Date.UTC` with explicit
 * defaults.
 *
 * Two absences are deliberate. `date.parse` is out because `Date.parse` on a
 * date-time with no offset reads the host's own timezone, so the same text is a
 * different moment on a different machine. `crypto.hash` and `crypto.hmac` are out
 * for a harder reason: they are deterministic, and they reach `CryptoEnginePort`, so
 * the guard below would refuse the claim, correctly. A verb whose answer comes from a
 * port cannot promise it touches nothing, whatever that port computes.
 */
const CLAIMS_PURITY: readonly string[] = [
  "date.format",
  "date.in",
  "date.of",
  "math.acos",
  "math.asin",
  "math.atan",
  "math.atan2",
  "math.cbrt",
  "math.cos",
  "math.cosh",
  "math.degrees",
  "math.exp",
  "math.factorial",
  "math.gcd",
  "math.hypot",
  "math.isClose",
  "math.isFinite",
  "math.isNaN",
  "math.lcm",
  "math.log",
  "math.log10",
  "math.log2",
  "math.max",
  "math.min",
  "math.radians",
  "math.sin",
  "math.sinh",
  "math.tan",
  "math.tanh",
  "math.trunc",
];

/**
 * The check itself: a claim is refused unless the walk saw the verb reach nothing.
 *
 * The honest edge, stated rather than skipped: a verb that threw before asking for a
 * port is one this guard could not place, so a `pure` claim on it is unproven rather
 * than checked. `math.log`, `math.log2` and `math.log10` are exactly that, refusing
 * zero arguments before reaching anything, and they are annotated on the strength of
 * a read instead. There is no port in their file for them to reach.
 */
describe("a verb may claim purity only if it reaches nothing", () => {
  it.each(EACH_PLUGIN)("%s claims purity for no verb that asks for a port", async (_ns, plugin) => {
    expect((await reachOf(plugin)).claimed).toEqual([]);
  });
});

/** Annotating a verb is a visible act, so the set is written down and compared. */
describe("the annotation is exactly what is written down", () => {
  it("names no verb this file does not list", () => {
    const claiming = allPlugins.flatMap((plugin) =>
      (plugin.actions ?? [])
        .filter((action) => action.pure)
        .map((action) => `${plugin.namespace}.${action.name}`),
    );

    expect(claiming.sort()).toEqual([...CLAIMS_PURITY].sort());
  });
});

/**
 * The annotation only ever widens what a `fn` may call, so a verb in a plugin that
 * declares nothing has no reason to carry it. One that did would be a second way to
 * say a thing already true, and the first of the two to drift.
 */
describe("the annotation is minimal", () => {
  it("annotates nothing in a plugin that declares no capability anyway", () => {
    const pointless = allPlugins
      .filter((plugin) => (plugin.requires ?? []).length === 0)
      .flatMap((plugin) => (plugin.actions ?? []).filter((action) => action.pure));

    expect(pointless).toEqual([]);
  });
});
