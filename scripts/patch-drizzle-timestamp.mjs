/**
 * Patch Drizzle ORM's MySqlTimestamp.mapFromDriverValue to handle Date objects correctly.
 * 
 * Problem: When mysql2 returns a Date object, Drizzle's mapFromDriverValue does:
 *   new Date(value + "+0000")
 * This converts the Date to a locale string first (e.g., "Mon Mar 16 2026 16:04:23 GMT+0800"),
 * then appends "+0000", causing new Date() to interpret local time as UTC → 8-hour offset.
 * 
 * Fix: If value is already a Date, return it directly.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetFile = path.resolve(__dirname, '../node_modules/drizzle-orm/mysql-core/columns/timestamp.js');

if (!fs.existsSync(targetFile)) {
  console.log('[patch-drizzle] timestamp.js not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(targetFile, 'utf8');

const buggyPattern = /mapFromDriverValue\(value\)\s*\{[\s\n]*return\s*\/\*\s*@__PURE__\s*\*\/\s*new\s+Date\(value\s*\+\s*"\+0000"\);/;
const fixedPattern = /mapFromDriverValue\(value\)\s*\{[\s\n]*if\s*\(value\s+instanceof\s+Date\)\s*return\s+value;/;

if (fixedPattern.test(content)) {
  console.log('[patch-drizzle] Already patched, skipping');
  process.exit(0);
}

if (buggyPattern.test(content)) {
  content = content.replace(
    buggyPattern,
    `mapFromDriverValue(value) {\n    if (value instanceof Date) return value;\n    return /* @__PURE__ */ new Date(value + "+0000");`
  );
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-drizzle] Successfully patched MySqlTimestamp.mapFromDriverValue');
} else {
  console.log('[patch-drizzle] Could not find expected pattern in timestamp.js, manual check needed');
}
