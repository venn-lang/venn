/**
 * What a decorator could have bound in the body it is applied to.
 *
 * `names` are the parameters a `deco` in reach can be read to add. `unreadable`
 * says one of the decorators applied could add a parameter this pass cannot
 * name, so nothing in the body underneath can be refused for being unbound.
 */
export interface AddedParams {
  readonly names: ReadonlySet<string>;
  readonly unreadable: boolean;
}
