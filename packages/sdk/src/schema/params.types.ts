/** One key of an action's options map, as the editor needs to present it. */
export interface ParamSpec {
  name: string;
  /** What the user has to write there: `string`, `map`, `number`… */
  type: string;
  /** The `.describe()` text from the schema, when the author wrote one. */
  doc?: string;
  required: boolean;
  /** The accepted literals, when the key is an enum. */
  values?: readonly string[];
}
