// Builds the course pages from data/courses/<code>/ (see build.mjs).
//
//   courses.json     which courses this language has
//   <course>/course.json    one course: its levels and what the whole thing builds up to
//   <course>/<levelId>.json one file per level, holding its sections
//
// Every page is rendered here as finished HTML, so it works with no JavaScript and can
// be cached for ever; src/course.js then adds speech, progress and practice.
//
//   dist/<code>/courses/index.html                        every course
//   dist/<code>/courses/<course>/index.html               one course, its levels
//   dist/<code>/courses/<course>/<level>/index.html       one level, its sections
//   dist/<code>/courses/<course>/<level>/<section>/       one section
//   dist/<code>/courses/<course>/data/<levelId>.json      the whole level, fetched on demand
import { readFileSync } from 'node:fs';
import { sentenceTokens, sentenceDistractors, distractorCount, buildable } from './sentence-tokens.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// one hue per category, so a section looks the same wherever it appears
const HUES = { communication: 210, grammar: 275, vocabulary: 140, pronunciation: 20, reference: 45 };
const EMOJI = { communication: '💬', grammar: '🔧', vocabulary: '📚', pronunciation: '🗣️', reference: '📋' };
const hue = (cat) => HUES[cat] ?? 210;

// same seed, same tiles: a rebuild with unchanged data produces an identical dist/
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- loading and checking ---------- */

export function loadCourses(dir) {
  const index = JSON.parse(readFileSync(`${dir}/courses.json`, 'utf8'));
  const courses = index.courses.map((entry) => {
    if (!entry.dir) return { ...entry, planned: true, levels: [] }; // a course that isn't written yet
    const meta = JSON.parse(readFileSync(`${dir}/${entry.dir}/course.json`, 'utf8'));
    const levels = meta.levels.map((l) => ({ ...l, ...JSON.parse(readFileSync(`${dir}/${entry.dir}/${l.file}`, 'utf8')) }));
    return { ...entry, meta, levels };
  });
  return { index, courses };
}

export function checkCourses({ index, courses }, phonetic) {
  const errors = [];
  if (!courses.length) errors.push('courses.json lists no courses');
  const slugs = new Set();
  for (const course of courses) {
    const at = course.slug || '(no slug)';
    if (!course.slug) errors.push('a course has no slug');
    if (slugs.has(course.slug)) errors.push(`${at}: duplicate course slug`);
    slugs.add(course.slug);
    if (course.planned) {
      if (!course.title) errors.push(`${at}: a planned course still needs a title`);
      continue;
    }
    if (!course.meta.title) errors.push(`${at}: course.json has no title`);
    if (!course.levels.length) errors.push(`${at}: no levels`);
    const levelSlugs = new Set();
    for (const level of course.levels) {
      if (level.levelId !== level.id) errors.push(`${at}/${level.file}: levelId "${level.levelId}" doesn't match "${level.id}" in course.json`);
      if (levelSlugs.has(level.slug)) errors.push(`${at}/${level.slug}: duplicate level slug`);
      levelSlugs.add(level.slug);
      if (!level.sections?.length) errors.push(`${at}/${level.id}: no sections`);
      const sectionSlugs = new Set();
      for (const s of level.sections || []) {
        const where = `${at}/${level.id}/${s.slug || s.id}`;
        if (!s.slug) errors.push(`${where}: missing slug`);
        else if (sectionSlugs.has(s.slug)) errors.push(`${where}: duplicate slug`);
        sectionSlugs.add(s.slug);
        if (s.levelId !== level.id) errors.push(`${where}: levelId is "${s.levelId}", expected "${level.id}"`);
        for (const f of ['id', 'title', 'category', 'objective']) if (!s[f]) errors.push(`${where}: missing ${f}`);
        if (!HUES[s.category]) errors.push(`${where}: unknown category "${s.category}"`);
        for (const x of s.examples || []) if (!x.es || !x.en) errors.push(`${where}: an example is missing es or en`);
      }
    }
  }
  if (!phonetic) errors.push('no pronunciation generator for this language');
  return errors;
}

// Adds what the pages need: a pronunciation where the text is plain enough for the
// generator, and the tiles for the sentence builder.
export function enrich({ courses }, phonetic) {
  const ph = (text) => { try { return phonetic(text) || undefined; } catch { return undefined; } };
  for (const course of courses) {
    for (const level of course.levels) {
      const corpus = level.sections.flatMap((s) => (s.examples || []).map((x) => x.es));
      for (const s of level.sections) {
        for (const x of s.examples || []) x.ph = ph(x.es);
        for (const p of s.patterns || []) p.ph = ph(speakable(p.form));
        // sid travels with each item, so finishing a level-wide round can credit
        // every section it touched
        s.build = (s.examples || []).filter((x) => buildable(x.es)).map((x) => ({
          sid: s.id,
          es: x.es,
          en: x.en,
          extra: sentenceDistractors(x.es, corpus, distractorCount(sentenceTokens(x.es).length), seeded(x.es)),
        }));
        s.cards = (s.examples || []).map((x) => ({ sid: s.id, es: x.es, en: x.en, ph: x.ph }));
      }
    }
  }
}

/* ---------- little helpers ---------- */

// What to send to the voice for a pattern like "Me llamo… / Soy…": drop the gaps and
// read the first option, so it doesn't say "slash" or trail off.
function speakable(text) {
  const first = String(text).split(/\s*\/\s*/)[0].replace(/…/g, '').replace(/\s+/g, ' ').trim();
  return /\p{L}/u.test(first) ? first : '';
}
const phHtml = (p) => esc(p).replace(/\b([A-Z]{2,}|[A-Z])\b/g, '<b>$1</b>');
const say = (text) => {
  const t = speakable(text);
  return t ? `<button class="tool" data-say="${esc(t)}" aria-label="Listen">🔊</button>` : '';
};
const sayPair = (text) => {
  const t = speakable(text);
  return t ? `<button class="tool spk" data-say="${esc(t)}" aria-label="Listen">🔊</button><button class="tool" data-slow="${esc(t)}" aria-label="Listen slowly">🐢</button>` : '';
};
const LABELS = {
  esESRules: 'Sounds in Spain', highValueVerbs: 'High-value verbs', examplesByType: 'By type',
  syllableExamples: 'Split into syllables', determinerCue: 'Which word gives it away', minimalPairs: 'Minimal pairs',
  answerFrame: 'Answer frame', datePattern: 'Dates', personalA: 'Personal a', routeChunks: 'Route chunks',
  shopChunks: 'In the shop', supportChunks: 'Useful chunks', recognitionSupport: 'Recognise these',
  nearDemonstratives: 'Near demonstratives', coreUses: 'Core uses', stressTypes: 'Stress types',
};
const label = (k) => LABELS[k] || (k.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()));
const sub = (text) => `<div class="sub">${esc(text)}</div>`;
const panel = (inner) => `<div class="panel">${inner}</div>`;
const crumb = (parts) => `<nav class="crumb" aria-label="Breadcrumb">${parts.map(([text, href]) =>
  (href ? `<a href="${href}">${esc(text)}</a> <span aria-hidden="true">›</span> ` : `<b>${esc(text)}</b>`)).join('')}</nav>`;

// A progress block reads its own ids: src/course.js fills in the bar and the wording
// from how many of those sections you've marked as refreshed.
const progressBlock = (ids, extra = '') =>
  `<div class="prog" data-prog="${ids.join(' ')}" ${extra}><div class="bar"><i style="width:0"></i></div><p class="pct"></p></div>`;

/* ---------- the reference block ---------- */
// The reference is free-form — every section shapes it differently — so each value is
// rendered by what it is: a note, a word list, a table of endings, a set of contrasts.

function renderReference(ref) {
  if (!ref || !Object.keys(ref).length) return '';
  const order = Object.keys(ref).filter((k) => k !== 'subjectOrder');
  return order.map((k) => renderRefValue(k, ref[k], ref)).filter(Boolean).join('');
}

function renderRefValue(key, value, ref) {
  const head = `<div class="ref-key">${esc(label(key))}</div>`;
  if (typeof value === 'string') return head + `<p class="ref-note">${esc(value)}</p>`;

  if (Array.isArray(value)) {
    if (!value.length) return '';
    // minimal pairs: [["pero","perro"], …]
    if (Array.isArray(value[0])) {
      return head + value.map((pair) => `<div class="pair">${pair.map((w, i) =>
        `${i ? '<span class="vs">vs</span>' : ''}<b lang="es">${esc(w)}</b>${say(w)}`).join('')}</div>`).join('');
    }
    // contrasts: [{ forms: [...], difference: "…" }, …]
    if (typeof value[0] === 'object' && value[0].forms) {
      return head + value.map((c) => `<div class="miss"><div>${c.forms.map((f) =>
        `<div class="yes" style="color:inherit" lang="es">${esc(f)}${say(f)}</div>`).join('')}</div>
        <p>${esc(c.difference || '')}</p></div>`).join('');
    }
    return head + `<div class="wordlist">${value.map((w) => `<span class="word" lang="es">${esc(w)}</span>`).join('')}</div>`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '';
    // a conjugation table, when every row lines up with subjectOrder
    const people = ref.subjectOrder;
    if (people && entries.every(([, v]) => Array.isArray(v) && v.length === people.length)) {
      return head + `<div class="tbl"><table><thead><tr><th></th>${people.map((p) =>
        `<th>${esc(p)}</th>`).join('')}</tr></thead><tbody>${entries.map(([verb, forms]) =>
        `<tr><th lang="es">${esc(verb)}</th>${forms.map((f) => `<td lang="es">${esc(f)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (entries.every(([, v]) => Array.isArray(v))) {
      return head + entries.map(([k, list]) => `<div class="ref-key" style="margin-top:8px">${esc(label(k))}</div>
        <div class="wordlist">${list.map((w) => `<span class="word" lang="es">${esc(w)}</span>`).join('')}</div>`).join('');
    }
    if (entries.every(([, v]) => typeof v === 'string')) {
      return head + entries.map(([k, v]) => {
        const term = k.replace(/_/g, ' ');
        return `<div class="pattern"><span class="t"><div class="form" lang="es">${esc(term)}</div>
          <div class="mean">${esc(v)}</div></span>${say(term)}</div>`;
      }).join('');
    }
    // anything else: show it as nested blocks rather than dropping it
    return head + entries.map(([k, v]) => renderRefValue(k, v, ref)).join('');
  }
  return '';
}

/* ---------- shared page furniture ---------- */

// Home always comes first, then as much of Courses › course › level as the page sits
// inside. `up` is the way back to /courses/, so every other link hangs off that and
// stays right whatever depth the page is at. src/course.css lays these out with flex,
// so two to four tabs all look right.
function navFor(up, { course, level, here }) {
  const tabs = [
    [`${up}../`, '🏠', 'Home', false],
    [up || './', '🎓', 'Courses', here === 'courses'],
  ];
  if (course) tabs.push([`${up}${course.slug}/`, '📘', course.shortTitle, here === 'course']);
  if (level) tabs.push([`${up}${course.slug}/${level.slug}/`, '📖', level.localLabel, here === 'level' || here === 'section']);
  return tabs.map(([href, icon, text, current]) =>
    `<a class="tab" href="${href}"${current ? ' aria-current="page"' : ''}><span>${icon}</span>${esc(text)}</a>`).join('');
}

const statusPill = (id) => `<span class="pill" data-status="${esc(id)}"></span>`;

function sectionCard(s, href, n) {
  return `<a class="card-link" href="${href}" style="--hue:${hue(s.category)}" data-cat="${esc(s.category)}"
      data-priority="${esc(s.priority || '')}" data-section="${esc(s.id)}">
    <span class="n">${n}</span>
    <span class="t"><b>${esc(s.title)}</b><small>${esc(s.objective)}</small></span>
    ${statusPill(s.id)}<span class="go" aria-hidden="true">›</span></a>`;
}

/* ---------- pages ---------- */

// /courses/ — every course this language has
export function renderCoursesPage({ index, courses }) {
  const body = `
    <div class="page-head" style="margin-top:14px">
      <h1>${esc(index.title)}</h1>
      <p class="lede">${esc(index.description)}</p>
    </div>
    <div id="continue" hidden></div>
    <div class="card-list">${courses.map((c, i) => {
      const ids = c.levels.flatMap((l) => l.sections.map((s) => s.id));
      const title = c.planned ? c.title : c.meta.title;
      const note = c.planned ? 'Not written yet'
        : `${c.meta.subtitle} · ${ids.length} sections`;
      const inner = `<span class="n">${i + 1}</span>
        <span class="t"><b>${esc(title)}</b><small>${esc(note)}</small>
          ${c.planned ? '' : `<span class="bar"><i style="width:0"></i></span><span class="pct"></span>`}</span>
        ${c.planned ? '<span class="badge">Soon</span>' : '<span class="go" aria-hidden="true">›</span>'}`;
      return c.planned
        ? `<div class="card-link planned" style="--hue:210">${inner}</div>`
        : `<a class="card-link" href="${c.slug}/" style="--hue:210" data-prog="${ids.join(' ')}">${inner}</a>`;
    }).join('')}</div>
    ${panel(`<h3>How this works</h3>
      <p style="margin:0;font-size:14.5px;color:var(--muted)">Work through a section, practise it, then mark it refreshed.
      Your progress is kept in this browser only. More courses appear here as they're added.</p>`)}`;
  return {
    body,
    nav: navFor('', { here: 'courses' }),
    up: '',
    title: index.title,
    description: index.description,
    page: { kind: 'courses' },
  };
}

// /courses/<course>/ — the levels in one course
export function renderCoursePage(course) {
  const { meta, levels } = course;
  const ids = levels.flatMap((l) => l.sections.map((s) => s.id));
  const body = `
    ${crumb([['Courses', '../'], [meta.shortTitle]])}
    <div class="page-head">
      <div class="badges"><span class="badge core">${esc(meta.shortTitle)}</span><span class="badge">${ids.length} sections</span></div>
      <h1>${esc(meta.title)}</h1>
      <p class="lede">${esc(meta.tagline || meta.description)}</p>
    </div>
    ${panel(`<h3>Your progress</h3>${progressBlock(ids)}`)}
    <div id="continue" hidden></div>
    <div class="search">
      <span class="glass">🔍</span>
      <input id="cSearch" type="search" placeholder="Search ${esc(meta.shortTitle)}… e.g. gustar" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
      <button class="clear" id="cClear" aria-label="Clear search" hidden>✕</button>
    </div>
    <div id="cResults" hidden></div>
    <div id="cIntro">
      ${sub('Levels')}
      <div class="card-list">${levels.map((l, i) => `
        <a class="card-link" href="${l.slug}/" style="--hue:${i === 0 ? 210 : 275}" data-prog="${l.sections.map((s) => s.id).join(' ')}">
          <span class="n">${i + 1}</span>
          <span class="t"><b>${esc(l.title)}</b><small>${l.sections.length} sections</small>
            <span class="bar"><i style="width:0"></i></span><span class="pct"></span></span>
          <span class="go" aria-hidden="true">›</span></a>`).join('')}</div>
      ${sub(`Practise across ${meta.shortTitle}`)}
      <div class="choices">${levels.map((l) => `
        <button class="choice" data-practice="build" data-level="data/${l.id}.json" data-title="🧱 ${esc(l.localLabel)}">
          <span>🧱</span><div><b>Build sentences · ${esc(l.localLabel)}</b><small>Tap the words into order, no typing</small></div><i>›</i></button>`).join('')}
      </div>
      ${sub(`What ${meta.shortTitle} builds up to`)}
      <p class="lead" style="margin-top:0">Not a checklist — the things to be able to do by the end.</p>
      ${meta.globalCheckpoints.map((cp) => panel(`<h3>${esc(cp.title)}</h3>
        <div class="wordlist">${cp.criteria.map((c) => `<span class="word">${esc(c)}</span>`).join('')}</div>`)).join('')}
    </div>`;
  return {
    body,
    nav: navFor('../', { course: { ...meta, slug: course.slug }, here: 'course' }),
    up: '../',
    title: meta.title,
    description: meta.description,
    page: { kind: 'course', courseSlug: course.slug, levels: levels.map((l) => ({ id: l.id, slug: l.slug, title: l.title, dataUrl: `data/${l.id}.json` })) },
  };
}

// /courses/<course>/<level>/ — the sections in one level
export function renderLevelPage(level, course) {
  const { meta } = course;
  const byCat = [...new Set(level.sections.map((s) => s.category))];
  const cover = Object.entries(level.syllabusCoverage || {});
  const ids = level.sections.map((s) => s.id);
  const body = `
    ${crumb([['Courses', '../../'], [meta.shortTitle, '../'], [level.localLabel]])}
    <div class="page-head">
      <div class="badges"><span class="badge">${esc(level.cefr)}</span><span class="badge">${level.sections.length} sections</span></div>
      <h1>${esc(level.title)}</h1>
      <p class="lede">${esc(level.purpose)}</p>
    </div>
    ${panel(`<h3>Your progress</h3>${progressBlock(ids)}`)}
    ${sub('Sections')}
    <div class="chips" id="cFilter">
      <button class="chip-btn" data-f="all" aria-pressed="true">All ${level.sections.length}</button>
      <button class="chip-btn" data-f="todo" aria-pressed="false">Still to do</button>
      <button class="chip-btn" data-f="core" aria-pressed="false">★ Core</button>
      ${byCat.map((c) => `<button class="chip-btn" data-f="${esc(c)}" aria-pressed="false">${EMOJI[c]} ${esc(label(c))}</button>`).join('')}
    </div>
    <div class="card-list">${level.sections.map((s, i) => sectionCard(s, `${s.slug}/`, i + 1)).join('')}</div>
    ${sub('Practise the whole level')}
    <div class="choices">
      <button class="choice" data-practice="build" data-level="../data/${level.id}.json" data-title="🧱 ${esc(level.localLabel)}"><span>🧱</span><div><b>Build the sentence</b><small>Tap the words into order, no typing</small></div><i>›</i></button>
      <button class="choice" data-practice="cards" data-level="../data/${level.id}.json" data-title="🃏 ${esc(level.localLabel)}"><span>🃏</span><div><b>Cards</b><small>English first — say it, then check and listen</small></div><i>›</i></button>
    </div>
    ${cover.length ? sub('What this level covers') + panel(cover.map(([k, list]) =>
      `<div class="ref-key">${esc(label(k))}</div><div class="wordlist">${list.map((x) => `<span class="word">${esc(x)}</span>`).join('')}</div>`).join('')) : ''}`;
  return {
    body,
    nav: navFor('../../', { course: { ...meta, slug: course.slug }, level, here: 'level' }),
    up: '../../',
    title: `${level.title} — ${meta.title}`,
    description: level.purpose,
    page: { kind: 'level', levelId: level.id, dataUrl: `../data/${level.id}.json` },
  };
}

// /courses/<course>/<level>/<section>/ — one section, split into tabs so the page is
// one thing at a time rather than a very long scroll
export function renderSectionPage(s, level, course, { prev, next }) {
  const { meta } = course;
  const h = hue(s.category);

  const learn = `
    ${s.explanation ? panel(`<p style="margin:0">${esc(s.explanation)}</p>`) : ''}
    ${s.patterns?.length ? sub('Patterns to reuse') + panel(s.patterns.map((p) => `<div class="pattern"><span class="t">
      <div class="form" lang="es">${esc(p.form)}</div><div class="mean">${esc(p.meaning)}</div>
      ${p.ph ? `<div class="ph">${phHtml(p.ph)}</div>` : ''}</span>${say(p.form)}</div>`).join('')) : ''}
    ${s.commonMistakes?.length ? sub('Watch out for') + s.commonMistakes.map((m) => `<div class="miss">
      <div class="no" lang="es">${esc(m.incorrect)}</div><div class="yes" lang="es">${esc(m.correct)}${say(m.correct)}</div>
      <p>${esc(m.explanation)}</p></div>`).join('') : ''}`;

  const examples = s.examples?.length
    ? panel(s.examples.map((x) => `<div class="ex" data-line><span class="t">
        <div class="es" lang="es">${esc(x.es)}</div><div class="en">${esc(x.en)}</div>
        ${x.ph ? `<div class="ph">${phHtml(x.ph)}</div>` : ''}</span>
        <span class="tools">${sayPair(x.es)}</span></div>`).join(''))
    : '';

  const reference = renderReference(s.reference);
  const referencePane = reference ? panel(reference) : '';

  const practise = `
    <div class="choices">
      ${s.build?.length ? `<button class="choice" data-practice="build" data-count="0" data-title="🧱 ${esc(s.title)}"><span>🧱</span><div><b>Build the sentence</b><small>${s.build.length} sentence${s.build.length === 1 ? '' : 's'} — tap the words into order</small></div><i>›</i></button>` : ''}
      ${s.examples?.length ? `<button class="choice" data-practice="cards" data-count="0" data-title="🃏 ${esc(s.title)}"><span>🃏</span><div><b>Cards</b><small>English first — say it, then check and listen</small></div><i>›</i></button>` : ''}
    </div>
    ${s.practicePrompts?.length ? sub('Try it out loud') + panel(s.practicePrompts.map((p) => `<div class="prompt-row">
      <div class="kind">${esc(p.type.replace(/-/g, ' '))}</div><b>${esc(p.prompt)}</b>
      ${p.answerGuide ? `<details><summary>What to include</summary><p>${esc(p.answerGuide)}</p></details>` : ''}</div>`).join('')) : ''}
    ${s.checkpoints?.length ? sub('Happy with all of this?') + panel(`<ul class="can">${s.checkpoints.map((c) =>
      `<li>${esc(c)}</li>`).join('')}</ul>`) : ''}
    ${panel(`<button class="btn block" id="markDone" type="button" aria-pressed="false"></button>
      <p class="pct" id="markNote" style="margin:8px 0 0;text-align:center"></p>`)}`;

  const panes = [
    ['learn', '📖', 'Learn', learn.trim()],
    ['ex', '💬', 'Examples', examples],
    ['ref', '📋', 'Reference', referencePane],
    ['do', '🎯', 'Practise', practise],
  ].filter(([, , , html]) => html);

  const tabs = `<div class="tabset">
    ${panes.map(([id], i) => `<input class="tab-in" type="radio" name="pane" id="pane-${id}"${i === 0 ? ' checked' : ''}>`).join('')}
    <div class="tab-bar" role="tablist">${panes.map(([id, icon, text]) =>
      `<label for="pane-${id}"><span aria-hidden="true">${icon}</span> ${esc(text)}</label>`).join('')}</div>
    ${panes.map(([id, , , html]) => `<div class="pane" data-pane="${id}">${html}</div>`).join('')}
  </div>`;

  const link = (x, cls, note) => (x
    ? `<a class="${cls}" href="../../${x.level.slug}/${x.section.slug}/"><small>${note}</small><b>${esc(x.section.title)}</b></a>`
    : '<span class="spacer"></span>');

  const body = `
    ${crumb([['Courses', '../../../'], [meta.shortTitle, '../../'], [level.localLabel, '../'], [s.title]])}
    <div class="page-head" style="--hue:${h}">
      <div class="badges">
        <span class="badge hue" style="--hue:${h}">${EMOJI[s.category]} ${esc(label(s.category))}</span>
        ${s.priority === 'core' ? '<span class="badge core">★ Core</span>' : `<span class="badge">${esc(label(s.priority || ''))}</span>`}
        ${s.learningTarget === 'active' ? '<span class="badge active">Say it yourself</span>' : '<span class="badge">Just recognise it</span>'}
        ${statusPill(s.id)}
      </div>
      <h1>${esc(s.title)}</h1>
      <p class="lede">${esc(s.objective)}</p>
    </div>
    ${tabs}
    <div class="updown">
      ${link(prev, 'prev', '← Previous')}
      ${link(next, 'next', 'Next →')}
    </div>`;
  return {
    body,
    nav: navFor('../../../', { course: { ...meta, slug: course.slug }, level, here: 'section' }),
    up: '../../../',
    title: `${s.title} — ${level.title}`,
    description: s.objective,
    page: {
      kind: 'section',
      sectionId: s.id,
      sectionTitle: s.title,
      courseSlug: course.slug,
      build: s.build || [],
      cards: s.cards || [],
    },
  };
}
