import type { Cell } from "@venn-lang/core";
import type { Scope } from "./scope.types.js";

/**
 * A lexical scope.
 *
 * A class, not an object literal: a `forEach` over 50k items builds 50k scopes,
 * and a literal allocates a closure per method for each of them. One prototype
 * does for all.
 *
 * Bindings live in cells rather than as bare values, so a compiled function can
 * address one once and read it by index on every call after. The cell exists as
 * soon as anyone asks for it, which is what lets a recursive `fn` work: the
 * closure asks for its own name while being built, before the binding fills it.
 */
class MapScope implements Scope {
  private readonly vars = new Map<string, Cell>();

  constructor(private readonly parent?: Scope) {}

  lookup(name: string): unknown {
    // A cell always exists once asked for, so its presence answers whether this
    // scope binds the name. A binding legitimately holding `undefined` reads as
    // its own value rather than falling through to the parent.
    const found = this.vars.get(name);
    return found === undefined ? this.parent?.lookup(name) : found.value;
  }

  set(name: string, value: unknown): void {
    const own = this.vars.get(name);
    if (own) {
      own.value = value;
      return;
    }
    this.vars.set(name, { value });
  }

  /**
   * The cell holding `name`, taken from wherever in the chain already has one.
   *
   * A function reading a global must get the global's own cell, not a fresh
   * local one that the binding would never fill. Only a name nobody has bound
   * anywhere gets its cell here, where a later `set` will land.
   */
  cell(name: string): Cell {
    const own = this.vars.get(name);
    if (own) return own;
    const inherited = this.parent?.cell(name);
    if (inherited) return inherited;
    const made: Cell = { value: undefined };
    this.vars.set(name, made);
    return made;
  }

  child(): Scope {
    return new MapScope(this);
  }

  root(): Scope {
    return this.parent ? this.parent.root() : this;
  }
}

/**
 * Create a scope; `lookup` falls back to the parent, `set` writes locally.
 *
 * @param parent The enclosing scope, or nothing for a root scope.
 */
export function createScope(parent?: Scope): Scope {
  return new MapScope(parent);
}
