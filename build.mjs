// Builds everything into dist/ (see languages.mjs):
//
//   dist/index.html            the lingobrix.com home page (src/home.html)
//   dist/<code>/index.html     one single-file app per language (src/app.html)
//   dist/<code>/courses/…      the study courses, one page per section (tools/course.mjs)
//   dist/sites.json            subdomain → folder, read by src/worker.js
//
//   node build.mjs          build everything
//   node build.mjs de       build just German (plus the home page)
//
// For each language it regenerates every pronunciation (ph), saves it back to the
// phrase file, and checks the data (ids, categories, required fields).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import languages from './languages.mjs';
import { phrasePh as spanishPh } from './tools/phonetic-es.mjs';
import { loadCourses, checkCourses, enrich, renderCoursesPage, renderCoursePage, renderLevelPage, renderSectionPage } from './tools/course.mjs';

const DOMAIN = 'lingobrix.com';
const only = process.argv.slice(2);
const app = readFileSync('src/app.html', 'utf8');
const coursePage = readFileSync('src/course-page.html', 'utf8');
const baseCss = readFileSync('src/base.css', 'utf8');
const courseCss = readFileSync('src/course.css', 'utf8');
// Scripts shared by the app and the course pages. They're plain scripts, not modules, so
// they can be dropped straight into either bundle; sentence-tokens.mjs is a real module
// (build-time code imports it too), so its export keywords come off on the way in.
const shared = [
  readFileSync('src/speech.js', 'utf8'),
  readFileSync('tools/sentence-tokens.mjs', 'utf8').replace(/^export /gm, ''),
  readFileSync('src/sentence-builder.js', 'utf8'),
].join('\n');
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

  const abcFile = `data/alphabet/${lang.code}.json`;
  const abc = JSON.parse(readFileSync(abcFile, 'utf8'));
  const errors = [...check(data, lang), ...checkAlphabet(abc, data, lang).map((e) => `${abcFile}: ${e}`)];
  if (errors.length) {
    console.error(`${lang.data}:\n  ${errors.join('\n  ')}`);
    failed = true;
    continue;
  }

  // only write when something changed, so `npm run watch` doesn't loop
  const updated = JSON.stringify(data, null, 2) + '\n';
  if (updated !== readFileSync(lang.data, 'utf8')) writeFileSync(lang.data, updated);
  const abcUpdated = JSON.stringify(abc, null, 2) + '\n';
  if (abcUpdated !== readFileSync(abcFile, 'utf8')) writeFileSync(abcFile, abcUpdated);

  const page = { ...lang.page, logoGradient: gradient(lang.page), favicon: favicon(lang.page) };
  const phrases = {
    categories: data.categories,
    phrases: data.phrases.map((p) => ({ id: p.id, cat: p.cat, dir: p.dir, en: p.en, tx: p[lang.field], ph: p.ph, note: p.note })),
  };
  // the way in to the courses, kept separate from the everyday-phrase choices
  const courseCard = lang.courses
    ? `<div class="sub">For grown-ups</div><div class="choices">
        <a class="choice" href="courses/"><span>🎓</span><div><b>${esc(lang.courses.title)}</b><small>${esc(lang.courses.blurb)}</small></div><i>›</i></a>
      </div>`
    : '';
  const html = fill(app, { ...page, courseCard }, `languages.mjs (${lang.code}.page)`)
    .replace('/*CSS*/', () => fill(baseCss, page, 'src/base.css'))
    .replace('/*SHARED*/', () => shared)
    .replace('/*PHRASES*/', () => json(phrases))
    .replace('/*LANG*/', () => json({ ...lang.app, ...switcher }))
    .replace('/*ALPHABET*/', () => json(abc));
  write(`dist/${lang.code}/index.html`, html);
  console.log(`Built dist/${lang.code}/ — ${lang.page.title}, ${data.phrases.length} phrases, ${kb(html)}`);

  if (lang.courses) buildCourses(lang, page);
}

const home = fill(readFileSync('src/home.html', 'utf8'), {
  favicon: favicon({ stripes: ['#e5484d', '#f5b82e', '#2e5bd8'], logo: 'LB', logoInk: '#ffffff', logoHalo: 'rgba(0,0,0,.45)' }),
  phrases: Math.min(...sites.map((s) => s.phrases)).toLocaleString('en-GB'),
  topics: Math.min(...sites.map((s) => s.topics)),
  languageList: new Intl.ListFormat('en-GB').format(sites.map((s) => s.language)),
  cards: sites.map((s) => `
    <a class="lang" data-code="${s.code}" href="https://${s.host}/"><span class="flag">${s.flag}</span>
      <div><b>${s.language}</b><small>${s.nativeName} · ${s.phrases.toLocaleString('en-GB')} phrases</small></div>
      <span class="go">Open →</span></a>`).join(''),
}, 'src/home.html').replace('/*SITES*/', () => json(sites));
write('dist/index.html', home);
write('dist/sites.json', JSON.stringify(Object.fromEntries(sites.map((s) => [s.host, s.code])), null, 2) + '\n');
console.log(`Built dist/ — home page, ${kb(home)}`);

if (failed) process.exit(1);

// data/courses/<code>/ → dist/<code>/courses/. The CSS and JS are shared by every page
// and named after their contents, so they can be cached hard and still change when edited.
function buildCourses(lang, page) {
  const all = loadCourses(lang.courses.dir);
  const errors = checkCourses(all, lang.phonetic);
  if (errors.length) {
    console.error(`${lang.courses.dir}:\n  ${errors.join('\n  ')}`);
    failed = true;
    return;
  }
  enrich(all, lang.phonetic);

  const css = fill(baseCss + '\n' + courseCss, page, 'src/base.css + src/course.css');
  const js = readFileSync('src/course.js', 'utf8').replace('/*SHARED*/', () => shared);
  const cssFile = `course.${hash(css)}.css`;
  const jsFile = `course.${hash(js)}.js`;
  const root = `dist/${lang.code}/courses`;
  write(`${root}/assets/${cssFile}`, css);
  write(`${root}/assets/${jsFile}`, js);

  const pages = [{ path: 'index.html', ...renderCoursesPage(all) }];
  let sections = 0;
  for (const course of all.courses) {
    if (course.planned) continue;
    // one flat list per course, so every section links to the one before and after it
    const flat = course.levels.flatMap((level) => level.sections.map((section) => ({ level, section })));
    sections += flat.length;
    pages.push({ path: `${course.slug}/index.html`, ...renderCoursePage(course) });
    for (const level of course.levels) {
      pages.push({ path: `${course.slug}/${level.slug}/index.html`, ...renderLevelPage(level, course) });
      // the whole level in one cacheable file: searching and level-wide practice fetch this
      const { file, ...rest } = level;
      write(`${root}/${course.slug}/data/${level.id}.json`, json(rest) + '\n');
    }
    for (const [i, x] of flat.entries()) {
      pages.push({
        path: `${course.slug}/${x.level.slug}/${x.section.slug}/index.html`,
        ...renderSectionPage(x.section, x.level, course, { prev: flat[i - 1], next: flat[i + 1] }),
      });
    }
  }

  for (const p of pages) {
    const html = fill(coursePage, {
      ...page,
      pageTitle: p.title,
      pageDescription: p.description,
      // p.up is the way back to /courses/; everything else hangs off the language root
      assets: `${p.up}assets`,
      cssFile,
      jsFile,
      appRoot: `${p.up}../`,
      appTitle: lang.page.title,
      homeRoot: `https://${DOMAIN}/`,
      courseSource: lang.courses.source,
      nav: p.nav,
      body: p.body,
    }, 'src/course-page.html').replace('/*PAGE*/', () => json({
      code: lang.code,
      speech: lang.app.speech,
      language: lang.page.language,
      storeKey: lang.courses.storeKey,
      apex: DOMAIN,
      localHome: `${p.up}../../`,
      ...p.page,
    }));
    write(`${root}/${p.path}`, html);
  }
  const names = all.courses.filter((c) => !c.planned).map((c) => c.meta.shortTitle).join(', ');
  console.log(`Built dist/${lang.code}/courses/ — ${names}, ${sections} sections, ${pages.length} pages`);
}

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

// data/alphabet/<code>.json: letter names, accents and spelling words (see the Alphabet & spelling page)
function checkAlphabet(abc, data, lang) {
  const errors = [];
  const text = data.phrases.map((p) => p[lang.field]).join(' ');
  const words = new Set((text.match(/[\p{L}]+/gu) || []).map((w) => w.toLowerCase()));
  const letters = abc.letters.map((x) => x.letter);
  const missing = [...'abcdefghijklmnopqrstuvwxyz'].filter((c) => !letters.includes(c));
  if (missing.length) errors.push(`letters missing: ${missing.join(' ')}`);
  if (new Set(letters).size !== letters.length) errors.push('a letter is listed twice');
  const named = new Set([...letters, ...abc.extras.map((x) => x.letter), ...abc.accents.map((x) => x.char)]);
  const unnamed = [...new Set([...text.toLowerCase()].filter((c) => /\p{L}/u.test(c) && !named.has(c)))];
  if (unnamed.length) errors.push(`no spoken name for: ${unnamed.join(' ')} (add them to accents)`);
  if (abc.words.length < 10) errors.push('needs at least 10 practice words');
  for (const w of abc.words) if (!words.has(w.tx.toLowerCase())) errors.push(`practice word "${w.tx}" isn't in ${lang.data}`);
  // pronunciation: generated for Spanish, hand-written (and format-checked) for the others
  const shape = /^[a-zA-Z]+(-[a-zA-Z]+)*( [a-zA-Z]+(-[a-zA-Z]+)*)*$/;
  const entries = [...abc.phrases.map((x) => [x, x.tx]),
    ...[...abc.letters, ...abc.extras, ...abc.accents].map((x) => [x, x.say]),
    ...[...abc.letters, ...abc.extras].flatMap((x) => (x.alt || []).map((a) => [a, a.say]))];
  for (const [x, spoken] of entries) {
    if (!spoken?.trim()) { errors.push(`missing text for ${JSON.stringify(x).slice(0, 60)}`); continue; }
    if (lang.code === 'es') {
      try { x.ph = spanishPh(spoken); } catch (e) { errors.push(`"${spoken}": ${e.message}`); }
    } else if (!shape.test(x.ph || '')) errors.push(`bad or missing ph for "${spoken}"`);
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

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
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
