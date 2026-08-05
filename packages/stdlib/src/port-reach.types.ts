/**
 * The part of a port these guards read: its identity, and what it asks the host
 * for. Deliberately not `AnyPort`: `@venn-lang/contracts` is a devDependency of
 * this package, and a shipping file importing it would be the production edge
 * `the-workspace-graph` exists to refuse. Two fields is the whole of what a
 * reach observation needs.
 */
export interface ReachedPort {
  id: string;
  requires: readonly string[];
}

/**
 * What driving every action of one plugin observed.
 *
 * `PluginDefinition.requires` is a promise, and until these guards nothing checked
 * it. Two capability checks already existed and neither closed the loop:
 * `assertPluginCaps` tests a plugin's own `requires` against the host at registry
 * build, and `assertCapabilities` tests a PORT's `requires` against the host at
 * bind time. Nothing compared the two, so a plugin that declared nothing and
 * reached `RandomPort` passed both on any host offering `random`. `math` did
 * exactly that, and so did `crypto` and `auth` through a port that declared
 * nothing itself.
 *
 * The cost was not theoretical. `requires` is what `check-pure-verb.ts` reads to
 * decide whether a `fn` may call a verb, so an empty declaration made
 * `math.randomInt` and `crypto.uuid` legal inside something the language calls
 * pure. It also broke the promise `std-io`'s README makes for the whole capability
 * model, that a host which cannot supply a capability is refused at load rather
 * than dying mid-run: on a host without `random`, `math` loaded clean and failed
 * at port bind partway through.
 */
export interface Reach {
  /** Ports some action asked for, by id, so two asks of one port count once. */
  ports: Map<string, ReachedPort>;
  /**
   * How many actions threw before asking for a single port.
   *
   * Actions are driven with empty arguments, so many fail somewhere. This is the
   * guards' honest edge, counted rather than hidden: a verb in here might reach a
   * port on a real argument, and nothing observed it.
   */
  undriven: number;
  /**
   * Verbs that declared `pure` and then asked for a port, which must be none.
   *
   * `pure` overrides the plugin's capability, so an over-claimed one admits a verb
   * into a pure body deliberately, at the moment its author was most confident.
   * `requires` was a promise nobody verified and was silently wrong in four
   * plugins; this is the same shape with a worse failure direction, so the same
   * walk checks it rather than leaving it to care.
   */
  claimed: string[];
}
