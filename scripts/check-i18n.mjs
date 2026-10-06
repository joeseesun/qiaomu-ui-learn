#!/usr/bin/env node
// Minimal i18n consistency check: zh and en dictionaries must cover the same keys.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "i18n.ts"), "utf8");

function extractDict(name) {
  const start = src.indexOf(`const ${name}: Dict = {`);
  if (start < 0) throw new Error(`dict ${name} not found`);
  const bodyStart = src.indexOf("{", start);
  let depth = 0, end = bodyStart;
  for (let i = bodyStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = src.slice(bodyStart + 1, end);
  const keys = [];
  for (const m of body.matchAll(/"([^"]+)":/g)) keys.push(m[1]);
  return new Set(keys);
}

const en = extractDict("en");
const zh = extractDict("zh");
let fail = false;
for (const k of en) if (!zh.has(k)) { console.error(`missing in zh: ${k}`); fail = true; }
for (const k of zh) if (!en.has(k)) { console.error(`missing in en: ${k}`); fail = true; }
console.log(`en keys: ${en.size}, zh keys: ${zh.size}`);
process.exit(fail ? 1 : 0);
