// Merge vendored Learn UI bilingual data into learnui.json and copy demo
// specimens next to main.js. Source of truth: vendor/learnui/ (data/ + demos/).
//
//   node scripts/build-learnui.mjs
//
// Output (bundled into main.js at build time — the community installer only ships
// main.js / manifest.json / styles.css):
//   data/learnui.json     merged EN+ZH entries + styles
//   data/demos.json       { "<slug>.html": html, "site.css": css }

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VENDOR = path.join(ROOT, "vendor", "learnui");
const OUT_DATA = path.join(ROOT, "data", "learnui.json");
const OUT_DEMOS = path.join(ROOT, "data", "demos.json");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ---- load EN + ZH ----------------------------------------------------------
const entries = readJson(path.join(VENDOR, "data", "entries.json"));
const styles = readJson(path.join(VENDOR, "data", "styles.json"));

const zhEntries = {};
for (const f of fs.readdirSync(path.join(VENDOR, "data", "zh"))) {
  if (/^entries-\d+\.json$/.test(f)) Object.assign(zhEntries, readJson(path.join(VENDOR, "data", "zh", f)));
}
const zhStyles = readJson(path.join(VENDOR, "data", "zh", "styles.json"));

// ---- merge entries ---------------------------------------------------------
const mergedEntries = entries.map((e) => {
  const z = zhEntries[e.slug] ?? {};
  const partsZh = z.parts_zh ?? {};
  return {
    slug: e.slug,
    platform: e.platform,
    name: e.name,
    nameZh: z.name_zh ?? null,
    tagline: e.tagline,
    taglineZh: z.tagline_zh ?? null,
    description: e.description ?? "",
    descriptionZh: z.description_zh ?? null,
    aka: e.aka ?? [],
    akaZh: z.aka_zh ?? [],
    fuzzy: e.fuzzy ?? [],
    fuzzyZh: z.fuzzy_zh ?? [],
    api: e.api ?? [],
    apiNotesZh: z.api_notes_zh ?? [],
    prompt: e.prompt ?? "",
    promptZh: z.prompt_zh ?? null,
    debugPrompt: e.debugPrompt ?? "",
    debugPromptZh: z.debugPrompt_zh ?? null,
    parts: (e.parts ?? []).map((p) => {
      const pz = partsZh[p.id] ?? {};
      return {
        id: p.id,
        name: p.name,
        nameZh: pz.name_zh ?? null,
        api: p.api ?? "",
        description: p.description ?? "",
        descriptionZh: pz.description_zh ?? null,
        prompt: p.prompt ?? "",
        promptZh: pz.prompt_zh ?? null,
      };
    }),
    related: e.related ?? [],
  };
});

// ---- merge styles ----------------------------------------------------------
const mergedStyles = styles.map((s) => {
  const z = zhStyles[s.slug] ?? {};
  const sigZh = z.signals_zh ?? {};
  const cwEn = s.confusedWith ?? null;
  const cwZh = z.confused_zh ?? {};
  return {
    slug: s.slug,
    order: s.order ?? null,
    name: s.name,
    nameZh: z.name_zh ?? null,
    tagline: s.tagline,
    taglineZh: z.tagline_zh ?? null,
    scope: s.scope ?? "",
    scopeZh: z.scope_zh ?? null,
    aliases: s.aliases ?? [],
    aliasesZh: z.aliases_zh ?? [],
    signals: (s.signals ?? []).map((sig) => {
      const sz = sigZh[sig.id] ?? {};
      return {
        id: sig.id,
        facet: sig.facet ?? "",
        role: sig.role ?? "",
        name: sig.name,
        nameZh: sz.name_zh ?? null,
        description: sig.description ?? "",
        descriptionZh: sz.description_zh ?? null,
      };
    }),
    confusedWith: cwEn
      ? {
          slug: cwEn.slug,
          name: cwEn.name,
          because: cwEn.because ?? "",
          becauseZh: cwZh.because_zh ?? null,
        }
      : null,
    seeAlso: s.seeAlso ?? [],
    accessibility: s.accessibility ?? "",
    accessibilityZh: z.accessibility_zh ?? null,
    origin: s.origin ?? "",
    originZh: z.origin_zh ?? null,
    code: s.code ?? [],
    brief: s.brief ?? "",
    briefZh: z.brief_zh ?? null,
  };
});

// ---- demos: one JSON map {file -> html}, bundled into main.js (fonts stripped) ----
const demos = {};
for (const f of fs.readdirSync(path.join(VENDOR, "demos")).sort()) {
  if (f.endsWith(".html")) demos[f] = fs.readFileSync(path.join(VENDOR, "demos", f), "utf8");
}
const nDemos = Object.keys(demos).length;
demos["site.css"] = fs
  .readFileSync(path.join(VENDOR, "site.css"), "utf8")
  .replace(/@font-face\s*\{[^}]*\}/g, "");
fs.mkdirSync(path.dirname(OUT_DEMOS), { recursive: true });
fs.writeFileSync(OUT_DEMOS, JSON.stringify(demos));

// ---- write merged data -----------------------------------------------------
const out = {
  v: 1,
  generated: new Date().toISOString(),
  source: "learnui (joeseesun/learnui, Learn UI Name · 界面叫啥)",
  entries: mergedEntries,
  styles: mergedStyles,
};
fs.writeFileSync(OUT_DATA, JSON.stringify(out));

console.log(
  `learnui: ${mergedEntries.length} entries + ${mergedStyles.length} styles, ${nDemos} demos -> ${path.relative(ROOT, OUT_DATA)}`,
);
