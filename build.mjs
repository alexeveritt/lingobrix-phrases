// Builds one single-file site per language (see languages.mjs).
//
//   node build.mjs          build every language
//   node build.mjs de       build just German
//
// For each language it:
// - regenerates every pronunciation (ph) and saves it back to the phrase file
// - checks the data (ids, categories, required fields)
// - fills src/index.html with the language's text and phrases, and writes <out>/index.html + _headers
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import languages from './languages.mjs';

const only = process.argv.slice(2);
const template = readFileSync('src/index.html', 'utf8');
let failed = false;

for (const lang of languages) {
  if (only.length && !only.includes(lang.code)) continue;
  const data = JSON.parse(readFileSync(lang.data, 'utf8'));
  const cats = new Set(data.categories.map((c) => c.id));
  const ids = new Set();
  const errors = [];

  for (const p of data.phrases) {
    if (ids.has(p.id)) errors.push(`duplicate id ${p.id}`);
    ids.add(p.id);
    if (!cats.has(p.cat)) errors.push(`#${p.id}: unknown category "${p.cat}"`);
    if (!['p', 't'].includes(p.dir)) errors.push(`#${p.id}: dir must be "p" or "t"`);
    for (const f of ['en', lang.field, 'note']) if (!p[f]?.trim()) errors.push(`#${p.id}: missing ${f}`);
    try {
      p.ph = lang.phonetic(p[lang.field]);
    } catch (e) {
      errors.push(`#${p.id} (${p[lang.field]}): ${e.message}`);
    }
  }
  if (errors.length) {
    console.error(`${lang.data}:\n  ${errors.join('\n  ')}`);
    failed = true;
    continue;
  }

  // only write when something changed, so `node --watch-path` doesn't loop
  const updated = JSON.stringify(data, null, 2) + '\n';
  if (updated !== readFileSync(lang.data, 'utf8')) writeFileSync(lang.data, updated);

  const page = { ...lang.page, logoGradient: gradient(lang.page.stripes), favicon: favicon(lang.page) };
  const phrases = {
    categories: data.categories,
    phrases: data.phrases.map((p) => ({ id: p.id, cat: p.cat, dir: p.dir, en: p.en, tx: p[lang.field], ph: p.ph, note: p.note })),
  };
  const html = template
    .replace(/\{\{(\w+)\}\}/g, (m, k) => {
      if (page[k] === undefined) throw new Error(`languages.mjs: ${lang.code}.page.${k} is not set`);
      return page[k];
    })
    .replace('/*PHRASES*/', () => json(phrases))
    .replace('/*LANG*/', () => json(lang.app));

  mkdirSync(lang.out, { recursive: true });
  writeFileSync(`${lang.out}/index.html`, html);
  copyFileSync('src/_headers', `${lang.out}/_headers`);
  console.log(`Built ${lang.out}/index.html — ${lang.page.title}, ${data.phrases.length} phrases, ${(html.length / 1024).toFixed(0)} KB`);
}
if (failed) process.exit(1);

function json(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function gradient([a, b, c]) {
  return `linear-gradient(180deg,${a} 0 33%,${b} 33% 67%,${c} 67%)`;
}

function favicon({ stripes: [a, b, c], logo, logoInk }) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><clipPath id='r'><rect width='100' height='100' rx='24'/></clipPath><g clip-path='url(#r)'><rect width='100' height='34' fill='${a}'/><rect y='33' width='100' height='34' fill='${b}'/><rect y='66' width='100' height='34' fill='${c}'/></g><text x='50' y='64' font-size='40' text-anchor='middle' font-family='Arial' font-weight='700' fill='${logoInk}' stroke='${a}' stroke-width='3' paint-order='stroke'>${logo}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27');
}
