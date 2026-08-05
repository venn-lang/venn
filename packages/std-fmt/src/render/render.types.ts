/**
 * The language's own writer, bound in by the runtime. See `ActionContext.show`.
 *
 * One writer for every format, because `250ms` is what a `250ms` is called and
 * a renderer that decided for itself wrote `{"kind":"duration","ms":250}`.
 */
export type Show = (value: unknown) => string;
