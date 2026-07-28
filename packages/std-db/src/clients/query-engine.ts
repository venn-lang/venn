import type { ExecArgs, QueryArgs, SeedData, TableMap } from "../port/index.js";
import type { Row } from "../types/index.js";

// A deliberately small SQL reader for the fake: it recognises the table name and
// little else. Enough to make a seeded test read like the real thing.

/** Deep copy of the tables. A snapshot that aliased live state would follow later edits. */
export function cloneTables(tables: TableMap): TableMap {
  return structuredClone(tables);
}

/** A tiny SELECT: pick the table named after `FROM`, optionally filter by `where`. */
export function selectRows(tables: TableMap, query: QueryArgs): Row[] {
  const rows = tables[tableName(query.sql, /from\s+([a-z_]\w*)/i)] ?? [];
  const where = query.where;
  const matched = where ? rows.filter((row) => matchesWhere(row, where)) : rows;
  return matched.map((row) => ({ ...row }));
}

/** A tiny mutation: INSERT appends rows; TRUNCATE/DELETE clears. Returns the count. */
export function execStatement(tables: TableMap, statement: ExecArgs): number {
  const inserted = tableName(statement.sql, /insert\s+into\s+([a-z_]\w*)/i);
  if (inserted) return insertRows(tables, inserted, statement.rows ?? []);
  return truncate(tables, tableName(statement.sql, /(?:truncate|delete\s+from)\s+([a-z_]\w*)/i));
}

/** Append rows into named tables; returns how many rows were loaded. */
export function seedTables(tables: TableMap, data: SeedData): number {
  let count = 0;
  for (const [name, rows] of Object.entries(data)) {
    const copies = rows.map((row) => ({ ...row }));
    tables[name] = [...(tables[name] ?? []), ...copies];
    count += copies.length;
  }
  return count;
}

function insertRows(tables: TableMap, name: string, rows: Row[]): number {
  const copies = rows.map((row) => ({ ...row }));
  tables[name] = [...(tables[name] ?? []), ...copies];
  return copies.length;
}

function truncate(tables: TableMap, name: string): number {
  const removed = tables[name]?.length ?? 0;
  if (name) tables[name] = [];
  return removed;
}

function matchesWhere(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function tableName(sql: string, pattern: RegExp): string {
  return pattern.exec(sql)?.[1] ?? "";
}
