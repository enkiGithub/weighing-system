/**
 * Patch Drizzle ORM's MySqlTimestamp.mapFromDriverValue to handle timestamps correctly.
 * 
 * Problem: Drizzle's mapFromDriverValue does:
 *   new Date(value + "+0000")
 * 
 * When mysql2 returns a string like "2026-03-16 17:48:48" (local time from MySQL),
 * appending "+0000" makes it: new Date("2026-03-16 17:48:48+0000")
 * This interprets the local time as UTC, causing an 8-hour offset for CST timezone.
 * 
 * Fix: Remove the "+0000" suffix. Use new Date(value) which correctly interprets
 * the string as local time, or returns the Date object directly if already a Date.
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

// Check if already patched (no "+0000" in mapFromDriverValue)
const alreadyPatched = /mapFromDriverValue\(value\)\s*\{[\s\n]*if\s*\(value\s+instanceof\s+Date\)\s*return\s+value;[\s\n]*return\s*\/\*\s*@__PURE__\s*\*\/\s*new\s+Date\(value\);/;
if (alreadyPatched.test(content)) {
  console.log('[patch-drizzle] Already patched, skipping');
  process.exit(0);
}

// Match the buggy pattern with "+0000"
const buggyPattern = /mapFromDriverValue\(value\)\s*\{[\s\n]*return\s*\/\*\s*@__PURE__\s*\*\/\s*new\s+Date\(value\s*\+\s*"\+0000"\);/;

// Also match the previous incomplete fix (instanceof Date check but still has +0000)
const partialFixPattern = /mapFromDriverValue\(value\)\s*\{[\s\n]*if\s*\(value\s+instanceof\s+Date\)\s*return\s+value;[\s\n]*return\s*\/\*\s*@__PURE__\s*\*\/\s*new\s+Date\(value\s*\+\s*"\+0000"\);/;

const replacement = `mapFromDriverValue(value) {\n    if (value instanceof Date) return value;\n    return /* @__PURE__ */ new Date(value);`;

if (partialFixPattern.test(content)) {
  content = content.replace(partialFixPattern, replacement);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-drizzle] Updated partial fix: removed "+0000" from mapFromDriverValue');
} else if (buggyPattern.test(content)) {
  content = content.replace(buggyPattern, replacement);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-drizzle] Successfully patched MySqlTimestamp.mapFromDriverValue (removed "+0000")');
} else {
  console.log('[patch-drizzle] Could not find expected pattern in timestamp.js, manual check needed');
}
