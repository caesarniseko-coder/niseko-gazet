/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Convert snake_case DB row keys to camelCase for TypeScript consumption.
 * Returns `any` because Supabase REST responses are dynamically typed.
 * Schema types are still enforced by Drizzle schema definitions.
 */
export function toCamelCase(row: Record<string, unknown>): any {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );
    result[camelKey] = value;
  }
  return result;
}

/**
 * Convert camelCase JS object keys to snake_case for DB inserts/updates.
 */
export function toSnakeCase(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(
      /[A-Z]/g,
      (letter) => `_${letter.toLowerCase()}`
    );
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Convert an array of DB rows to camelCase typed objects.
 */
export function mapRows(rows: Record<string, unknown>[]): any[] {
  return rows.map((row) => toCamelCase(row));
}
