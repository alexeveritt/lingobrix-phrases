// The course pages (dist/<code>/courses/…). Every page is already rendered as static
// HTML by tools/course.mjs; this adds the parts that need a browser: speech, progress,
// the practice overlay and searching a course.
//
// build.mjs puts src/speech.js, tools/sentence-tokens.mjs and src/sentence-builder.js
// in front of this file, so createSpeech and sentenceBuilder are already in scope.
(() => {
'use strict';
/*SHARED*/
const PAGE = JSON.parse(document.getElementById('page').textContent);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- progress ---------- */
// Progress is earned, not declared: practising a section marks it "practised" by
// itself, and one tap on the section page marks it "refreshed".
//
//   sec:  { "<sectionId>": { p: rounds practised, r: 1 when refreshed } }
//   last: the section you were last on, for the Continue link
const store = (() => {
  let s = { sec: {}, last: null };
  try { Object.assign(s, JSON.parse(localStorage.getItem(PAGE.storeKey) || '{}')); } catch (e) {}
  if (!s.sec || typeof s.sec !== 'object') s.sec = {};
  return { s, save: () => { try { localStorage.setItem(PAGE.storeKey, JSON.stringify(s)); } catch (e) {} } };
})();
const S = store.s;
const stateOf = id => { const r = S.sec[id]; return r?.r ? 'refreshed' : r?.p ? 'practised' : 'new'; };
const STATE = {
  refreshed: ['✓ Refreshed', 'ok'],
  practised: ['Practised', 'mid'],
  new: ['', ''],
};
function practised(ids) {
  let changed = false;
  for (const id of new Set(ids)) {
    if (!id) continue;
    const r = (S.sec[id] ??= { p: 0 });
    r.p++;
    changed = true;
  }
  if (changed) { store.save(); drawProgress(); }
}
function setRefreshed(id, on) {
  const r = (S.sec[id] ??= { p: 0 });
  if (on) r.r = 1; else delete r.r;
  store.save();
  drawProgress();
}

// Fills in every progress bar, status pill and the "mark as refreshed" button from
// what's been done. The build put the section ids in the HTML.
function drawProgress() {
  for (const el of $$('[data-prog]')) {
    const ids = el.dataset.prog.split(' ').filter(Boolean);
    const done = ids.filter(id => stateOf(id) === 'refreshed').length;
    const started = ids.filter(id => stateOf(id) === 'practised').length;
    const bar = $('.bar i', el);
    if (bar) bar.style.width = `${ids.length ? Math.round((done / ids.length) * 100) : 0}%`;
    const pct = $('.pct', el);
    if (pct) {
      pct.textContent = !ids.length ? ''
        : done === ids.length ? `All ${ids.length} sections refreshed 🎉`
        : `${done} of ${ids.length} refreshed${started ? `, ${started} practised` : ''}`;
    }
  }
  for (const el of $$('[data-status]')) {
    const [text, cls] = STATE[stateOf(el.dataset.status)];
    el.textContent = text;
    el.className = `pill ${cls}`;
    el.hidden = !text;
  }
  for (const card of $$('[data-section]')) card.dataset.state = stateOf(card.dataset.section);
  drawMark();
}

// the section page's one button, in place of a list of abstract checkpoints
const markBtn = $('#markDone');
function drawMark() {
  if (!markBtn) return;
  const id = PAGE.sectionId;
  const on = stateOf(id) === 'refreshed';
  const rounds = S.sec[id]?.p || 0;
  markBtn.textContent = on ? '✓ Refreshed — tap to undo' : "I'm happy with this section";
  markBtn.classList.toggle('good', on);
  markBtn.setAttribute('aria-pressed', String(on));
  $('#markNote').textContent = on ? 'It counts towards your progress.'
    : rounds ? `Practised ${rounds} time${rounds === 1 ? '' : 's'}.`
    : 'Practise it first, then mark it when you can do it without looking.';
}
if (markBtn) markBtn.onclick = () => setRefreshed(PAGE.sectionId, stateOf(PAGE.sectionId) !== 'refreshed');

// remember where you were, so Courses and the course page can offer to carry on
if (PAGE.kind === 'section') {
  S.last = { id: PAGE.sectionId, title: PAGE.sectionTitle, course: PAGE.courseSlug, href: location.pathname };
  store.save();
}
const continueBox = $('#continue');
if (continueBox && S.last?.href) {
  // only offer it from a page the link actually reaches from
  const here = location.pathname.replace(/[^/]*$/, '');
  if (S.last.href.startsWith(here) && S.last.href !== location.pathname) {
    continueBox.innerHTML = `<a class="card-link" href="${esc(S.last.href)}" style="--hue:140">
      <span class="n">↺</span><span class="t"><b>Carry on</b><small>${esc(S.last.title)}</small></span>
      <span class="go" aria-hidden="true">›</span></a>`;
    continueBox.hidden = false;
  }
}
drawProgress();

/* ---------- speech ---------- */
let toastT;
function toast(msg) {
  $('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 1600);
}
// on lingobrix.com the home page is the apex domain; locally (npm run dev) it's just /
const onLive = location.hostname === PAGE.apex || location.hostname.endsWith('.' + PAGE.apex);
if (!onLive) $$('[data-home]').forEach(a => { a.href = PAGE.localHome; });

const SPEECH = createSpeech({ speech: PAGE.speech, code: PAGE.code, language: PAGE.language, onError: toast });
const { canSpeak, speak, stop: stopSpeech } = SPEECH;
if (!canSpeak) $$('[data-say],[data-slow]').forEach(b => b.remove());

document.addEventListener('click', e => {
  const b = e.target.closest('[data-say],[data-slow]');
  if (!b) return;
  // the Spanish is in the attribute, so any page can speak without loading the data file
  if (b.dataset.slow !== undefined) speak(b.dataset.slow, true, b.closest('[data-line]')?.querySelector('.es'));
  else speak(b.dataset.say);
});

/* ---------- the shared level files ---------- */
// Section pages carry the handful of sentences they need. Everything wider than one
// section (searching, or practising a whole level) fetches the level file instead.
const cache = new Map();
async function levelData(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  try { return await cache.get(url); } catch (e) { cache.delete(url); toast('Could not load the course data'); throw e; }
}
const itemsOf = (level, mode) => level.sections.flatMap(s => (mode === 'build' ? s.build : s.cards) || [])
  .map(x => ({ ...x, section: level.sections.find(s => s.id === x.sid)?.title }));

/* ---------- practice overlay ---------- */
const P = {};
const overlay = $('#practice');
function openOverlay() {
  overlay.hidden = false;
  document.body.classList.add('locked');
  if (history.state?.ov) history.replaceState({ ov: 1 }, ''); else history.pushState({ ov: 1 }, '');
}
function hideOverlay() {
  overlay.hidden = true;
  document.body.classList.remove('locked');
  stopSpeech();
}
function closeOverlay() { if (history.state?.ov) history.back(); else hideOverlay(); }
$$('[data-close]').forEach(b => b.onclick = closeOverlay);
window.addEventListener('popstate', () => { if (!history.state?.ov) hideOverlay(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeOverlay(); });

function startPractice({ mode, items, title, count = 10 }) {
  items = items.filter(x => x && x.es);
  if (!items.length) return toast('Nothing to practise here yet');
  Object.assign(P, { mode, all: items, list: shuffle(items).slice(0, count || items.length), i: 0, right: 0, wrong: [], title, count,
    credited: new Set() }); // each section counts once per round, however far you get
  $('#pTitle').textContent = title;
  openOverlay();
  drawQ();
}
function drawQ() {
  const body = $('#pBody');
  $('#pBar').style.width = `${(P.i / P.list.length) * 100}%`;
  $('#pScore').textContent = `${Math.min(P.i + 1, P.list.length)}/${P.list.length}`;
  if (P.i >= P.list.length) return drawResult();
  const x = P.list[P.i];
  if (P.mode === 'build') {
    // no big prompt card here: the English sits inside the builder, leaving the phone
    // screen for the tiles
    body.innerHTML = `<p class="q-kicker">🧱 Put the words in order${x.section ? ` · ${esc(x.section)}` : ''}</p>
      <div class="panel" id="sbHost"></div><div id="sbNext"></div>`;
    const b = sentenceBuilder({
      text: x.es, en: x.en, lang: PAGE.code,
      extra: x.extra?.length ? x.extra : sentenceDistractors(x.es, P.all.map(i => i.es), distractorCount(sentenceTokens(x.es).length)),
      speak: canSpeak ? (t => speak(t)) : null,
      onDone: ok => next(x, ok),
    });
    $('#sbHost').append(b.el);
  } else {
    body.innerHTML = `<div class="prompt"><div class="band"></div><div class="in">
        ${x.section ? `<div class="lang">${esc(x.section)}</div>` : ''}<div class="lang">🇬🇧 How do you say…</div>
        <div class="big">${esc(x.en)}</div>
        <div class="tapme">Say it in ${esc(PAGE.language)}, then tap to check</div></div></div><div id="sbNext"></div>`;
    $('.prompt', body).onclick = () => {
      if ($('#pAns')) return;
      $('#sbNext').innerHTML = `<div class="panel" style="margin-top:12px" id="pAns">
          <div class="ex"><div class="t"><div class="es" lang="${PAGE.code}">${esc(x.es)}</div>${x.ph ? `<div class="ph">${phHtml(x.ph)}</div>` : ''}</div>
          ${canSpeak ? `<div class="tools"><button class="tool spk" data-say="${esc(x.es)}">🔊</button><button class="tool" data-slow="${esc(x.es)}">🐢</button></div>` : ''}</div></div>
        <div class="answer-row"><button class="btn bad" data-a="0">😅 Not yet</button><button class="btn ok" data-a="1">😎 Got it</button></div>`;
      if (canSpeak) speak(x.es);
      $('#sbNext').onclick = e => { const b = e.target.closest('[data-a]'); if (b) next(x, b.dataset.a === '1'); };
    };
  }
  body.scrollTop = 0;
}
function next(x, ok) {
  if (P.mode === 'build') {
    $('#sbNext').innerHTML = '<button class="btn primary block" id="pNext" style="margin-top:12px;height:54px">Next →</button>';
    $('#pNext').onclick = () => score(x, ok);
    $('#pNext').focus({ preventScroll: true });
    return;
  }
  score(x, ok);
}
function score(x, ok) {
  stopSpeech();
  // credit the section as soon as you've worked on it, so leaving part-way still counts
  if (x.sid && !P.credited.has(x.sid)) { P.credited.add(x.sid); practised([x.sid]); }
  if (ok) P.right++; else P.wrong.push(x);
  P.i++;
  drawQ();
}
function drawResult() {
  $('#pBar').style.width = '100%';
  $('#pScore').textContent = 'Done';
  const n = P.list.length, pct = Math.round((P.right / n) * 100);
  const [emoji, words] = pct === 100 ? ['🏆', '¡Increíble! Perfect score'] : pct >= 80 ? ['🌟', '¡Muy bien! Great work']
    : pct >= 50 ? ['💪', '¡Bien! Keep going'] : ['🌱', '¡Ánimo! Practice makes perfect'];
  // a round that went well, from a single section, is the natural moment to mark it off
  const only = [...new Set(P.list.map(x => x.sid).filter(Boolean))];
  const offer = only.length === 1 && pct >= 80 && stateOf(only[0]) !== 'refreshed';
  $('#pBody').innerHTML = `<div class="result"><div class="emoji">${emoji}</div><div class="score">${P.right}/${n}</div><div>${words}</div>
    <div style="display:grid;gap:8px;margin-top:18px">
      ${offer ? '<button class="btn good block" id="rMark">✓ Mark this section as refreshed</button>' : ''}
      ${P.wrong.length ? `<button class="btn primary block" id="rMissed">🔁 The ${P.wrong.length} I missed</button>` : ''}
      <button class="btn block" id="rAgain">🎯 New round</button>
      <button class="btn block" id="rDone">Done</button></div></div>
    ${P.wrong.length ? `<div class="sub">To work on</div><div class="panel">${P.wrong.map(x =>
      `<div class="ex"><div class="t"><div class="es" lang="${PAGE.code}">${esc(x.es)}</div><div class="en">${esc(x.en)}</div></div></div>`).join('')}</div>` : ''}`;
  if (offer) {
    $('#rMark').onclick = e => { setRefreshed(only[0], true); e.target.textContent = '✓ Marked'; e.target.disabled = true; };
  }
  const missed = P.wrong.slice();
  if (missed.length) $('#rMissed').onclick = () => startPractice({ mode: P.mode, items: missed, title: '🔁 Missed ones', count: 0 });
  $('#rAgain').onclick = () => startPractice({ mode: P.mode, items: P.all, title: P.title, count: P.count });
  $('#rDone').onclick = closeOverlay;
}
function phHtml(ph) { return esc(ph).replace(/\b([A-Z]{2,}|[A-Z])\b/g, '<b>$1</b>'); }

/* ---------- launchers ---------- */
// data-practice="build|cards", with either this page's own sentences or a level to fetch
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-practice]');
  if (!b) return;
  const mode = b.dataset.practice;
  const title = b.dataset.title || (mode === 'build' ? '🧱 Build the sentence' : '🃏 Cards');
  if (b.dataset.level) {
    const was = b.innerHTML;
    b.disabled = true; b.textContent = 'Loading…';
    try {
      const level = await levelData(b.dataset.level);
      startPractice({ mode, items: itemsOf(level, mode), title, count: +b.dataset.count || 10 });
    } catch (err) { /* levelData has already said so */ }
    b.disabled = false; b.innerHTML = was;
  } else {
    startPractice({ mode, items: PAGE[mode] || [], title, count: +b.dataset.count || 10 });
  }
});

/* ---------- search (course page) ---------- */
const searchBox = $('#cSearch');
if (searchBox) {
  const out = $('#cResults');
  const intro = $('#cIntro');
  let all = null;
  let timer;
  const load = async () => {
    if (all) return all;
    const levels = await Promise.all(PAGE.levels.map(l => levelData(l.dataUrl).then(d => [l, d])));
    all = levels.flatMap(([l, d]) => d.sections.map(s => ({
      href: `${l.slug}/${s.slug}/`,
      level: l.title,
      title: s.title,
      objective: s.objective,
      hay: fold([s.title, s.objective, s.explanation, (s.tags || []).join(' '),
        ...(s.patterns || []).map(p => `${p.form} ${p.meaning}`),
        ...(s.examples || []).map(x => `${x.es} ${x.en}`)].join(' ')),
    })));
    return all;
  };
  const run = async () => {
    const q = fold(searchBox.value.trim());
    intro.hidden = !!q;
    out.hidden = !q;
    $('#cClear').hidden = !searchBox.value;
    if (!q) return;
    out.innerHTML = '<p class="count">Searching…</p>';
    let list;
    try { list = await load(); } catch (err) { out.innerHTML = '<p class="count">Could not load the course data.</p>'; return; }
    if (fold(searchBox.value.trim()) !== q) return; // a newer search has started
    const terms = q.split(/\s+/).filter(Boolean);
    const hits = list.filter(s => terms.every(t => s.hay.includes(t)));
    out.innerHTML = hits.length
      ? `<p class="count">${hits.length} section${hits.length === 1 ? '' : 's'}</p><div class="card-list">${hits.map(s =>
          `<a class="hit" href="${s.href}"><b>${esc(s.title)}</b><small>${esc(s.level)} · ${esc(s.objective)}</small></a>`).join('')}</div>`
      : `<div class="empty"><b>🤔</b>Nothing for “${esc(searchBox.value.trim())}”.<br>Try <i>gustar</i>, <i>food</i> or <i>directions</i>.</div>`;
  };
  searchBox.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, searchBox.value.trim() ? 120 : 0); });
  searchBox.addEventListener('keydown', e => { if (e.key === 'Enter') searchBox.blur(); });
  $('#cClear').onclick = () => { searchBox.value = ''; run(); searchBox.focus(); };
}

/* ---------- filters (level page) ---------- */
const filters = $('#cFilter');
if (filters) {
  filters.onclick = e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    $$('[data-f]', filters).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.f;
    for (const card of $$('[data-section]')) {
      card.hidden = f === 'all' ? false
        : f === 'todo' ? card.dataset.state === 'refreshed'
        : card.dataset.cat !== f && card.dataset.priority !== f;
    }
  };
}
})();
