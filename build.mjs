// Builds public/index.html from src/index.html + phrases.json.
//
//   node build.mjs
//
// - regenerates every pronunciation (ph) from the Spanish and saves it back to phrases.json
// - checks the data (ids, categories, required fields)
// - inlines the phrases into the page so the site is a single cached file
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { phrasePh } from './tools/phonetic.mjs';

const data = JSON.parse(readFileSync('phrases.json', 'utf8'));
const cats = new Set(data.categories.map((c) => c.id));
const ids = new Set();
const errors = [];

for (const p of data.phrases) {
  if (ids.has(p.id)) errors.push(`duplicate id ${p.id}`);
  ids.add(p.id);
  if (!cats.has(p.cat)) errors.push(`#${p.id}: unknown category "${p.cat}"`);
  if (!['p', 't'].includes(p.dir)) errors.push(`#${p.id}: dir must be "p" or "t"`);
  for (const f of ['en', 'es', 'note']) if (!p[f]?.trim()) errors.push(`#${p.id}: missing ${f}`);
  try {
    p.ph = phrasePh(p.es);
  } catch (e) {
    errors.push(`#${p.id} (${p.es}): ${e.message}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

// only write when something changed, so `node --watch-path` doesn't loop
const updated = JSON.stringify(data, null, 2) + '\n';
if (updated !== readFileSync('phrases.json', 'utf8')) writeFileSync('phrases.json', updated);

const pageData = {
  categories: data.categories,
  phrases: data.phrases.map(({ id, cat, dir, en, es, ph, note }) => ({ id, cat, dir, en, es, ph, note })),
};
const json = JSON.stringify(pageData).replace(/</g, '\\u003c');
const html = readFileSync('src/index.html', 'utf8').replace('/*PHRASES*/', () => json);

mkdirSync('public', { recursive: true });
writeFileSync('public/index.html', html);
console.log(`Built public/index.html — ${data.phrases.length} phrases, ${(html.length / 1024).toFixed(0)} KB`);
