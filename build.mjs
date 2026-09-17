// Builds everything into dist/ (see languages.mjs):
//
//   dist/index.html         the lingobrix.com home page (src/home.html)
//   dist/<code>/index.html  one single-file app per language (src/app.html)
//   dist/sites.json         subdomain → folder, read by src/worker.js
//
//   node build.mjs          build everything
//   node build.mjs de       build just German (plus the home page)
//
// For each language it regenerates every pronunciation (ph), saves it back to the
// phrase file, and checks the data (ids, categories, required fields).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import languages from './languages.mjs';

const DOMAIN = 'lingobrix.com';
const only = process.argv.slice(2);
const app = readFileSync('src/app.html', 'utf8');
let failed = false;

if (!only.length) rmSync('dist', { recursive: true, force: true });

// every site, for the home page and each app's language switcher
const datasets = Object.fromEntries(languages.map((l) => [l.code, JSON.parse(readFileSync(l.data, 'utf8'))]));
const sites = languages.map((l) => ({
  code: l.code,
  host: `${l.subdomain}.${DOMAIN}`,
  language: l.page.language,
  nativeName: l.nativeName,
  flag: l.app.flag,
  phrases: datasets[l.code].phrases.length,
  topics: datasets[l.code].categories.length,
}));
const switcher = { apex: DOMAIN, sites: sites.map(({ code, host, language, nativeName, flag }) => ({ code, host, language, nativeName, flag })) };

for (const lang of languages) {
  const data = datasets[lang.code];
  if (only.length && !only.includes(lang.code)) continue;

  const errors = check(data, lang);
  if (errors.length) {
    console.error(`${lang.data}:\n  ${errors.join('\n  ')}`);
    failed = true;
    continue;
  }

  // only write when something changed, so `npm run watch` doesn't loop
  const updated = JSON.stringify(data, null, 2) + '\n';
  if (updated !== readFileSync(lang.data, 'utf8')) writeFileSync(lang.data, updated);

  const page = { ...lang.page, logoGradient: gradient(lang.page), favicon: favicon(lang.page) };
  const phrases = {
    categories: data.categories,
    phrases: data.phrases.map((p) => ({ id: p.id, cat: p.cat, dir: p.dir, en: p.en, tx: p[lang.field], ph: p.ph, note: p.note })),
  };
  const html = fill(app, page, `languages.mjs (${lang.code}.page)`)
    .replace('/*PHRASES*/', () => json(phrases))
    .replace('/*LANG*/', () => json({ ...lang.app, ...switcher }));
  write(`dist/${lang.code}/index.html`, html);
  console.log(`Built dist/${lang.code}/ — ${lang.page.title}, ${data.phrases.length} phrases, ${kb(html)}`);
}

const home = fill(readFileSync('src/home.html', 'utf8'), {
  favicon: favicon({ stripes: ['#e5484d', '#f5b82e', '#2e5bd8'], logo: 'LB', logoInk: '#ffffff', logoHalo: 'rgba(0,0,0,.45)' }),
  phrases: Math.min(...sites.map((s) => s.phrases)).toLocaleString('en-GB'),
  topics: Math.min(...sites.map((s) => s.topics)),
  cards: sites.map((s) => `
    <a class="lang" data-code="${s.code}" href="https://${s.host}/"><span class="flag">${s.flag}</span>
      <div><b>${s.language}</b><small>${s.nativeName} · ${s.phrases.toLocaleString('en-GB')} phrases</small></div>
      <span class="go">Open →</span></a>`).join(''),
}, 'src/home.html').replace('/*SITES*/', () => json(sites));
write('dist/index.html', home);
write('dist/sites.json', JSON.stringify(Object.fromEntries(sites.map((s) => [s.host, s.code])), null, 2) + '\n');
console.log(`Built dist/ — home page, ${kb(home)}`);

if (failed) process.exit(1);

function check(data, lang) {
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
  return errors;
}

function fill(template, values, source) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (values[k] === undefined) throw new Error(`{{${k}}} has no value in ${source}`);
    return values[k];
  });
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function json(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function kb(text) {
  return `${(Buffer.byteLength(text) / 1024).toFixed(0)} KB`;
}

function gradient({ stripes: [a, b, c], vertical }) {
  return `linear-gradient(${vertical ? 90 : 180}deg,${a} 0 33%,${b} 33% 67%,${c} 67%)`;
}

function favicon({ stripes, vertical, logo, logoInk, logoHalo }) {
  const band = (fill, i) => (vertical
    ? `<rect x='${i * 33}' width='34' height='100' fill='${fill}'/>`
    : `<rect y='${i * 33}' width='100' height='34' fill='${fill}'/>`);
  const [a] = stripes;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><clipPath id='r'><rect width='100' height='100' rx='24'/></clipPath><g clip-path='url(#r)'>${stripes.map(band).join('')}</g><text x='50' y='64' font-size='40' text-anchor='middle' font-family='Arial' font-weight='700' fill='${logoInk}' stroke='${logoHalo === 'transparent' ? a : logoHalo}' stroke-width='3' paint-order='stroke'>${logo}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27');
}
