// A word-bank puzzle: tap the tiles in order to build the sentence, no typing.
//
// The course section pages and the app's "Build the sentence" practice mode both use
// this. build.mjs inlines this file, together with tools/sentence-tokens.mjs, into the
// app and into the course bundle, so there's one copy of the behaviour.
//
//   const b = sentenceBuilder({ text: 'Me llamo Alex.', extra: ['soy'], en: 'My name is Alex.' });
//   mount.append(b.el);
//
//   text   the sentence to build
//   extra  tiles that don't belong in it
//   en     the English prompt, shown above the tiles
//   speak  optional (text) => void for the 🔊 button, shown once the answer is in
//   onDone called with true (right) or false (wrong or shown) when it's answered

function sentenceBuilder({ text, extra = [], en = '', lang = 'es', speak, onDone } = {}) {
  const want = sentenceTokens(text);
  const sentence = want.join(' ');
  // shuffle first, then number them: a tile's number is where it sits in the bank
  const words = want.concat(extra);
  for (let i = words.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [words[i], words[j]] = [words[j], words[i]];
  }
  const tiles = words.map((w, i) => ({ w, i }));
  let placed = []; // tile indexes, in the order they were tapped
  let done = false;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = document.createElement('div');
  el.className = 'sb';
  el.innerHTML = `
    ${en ? `<p class="sb-prompt">${esc(en)}</p>` : ''}
    <div class="sb-line" data-line role="group" aria-label="Your sentence"></div>
    <div class="sb-bank" data-bank role="group" aria-label="Word bank"></div>
    <div class="sb-tools"><button class="btn" type="button" data-sb-show>🤷 Show me</button><button class="btn primary" type="button" data-sb-check>Check ✓</button></div>
    <div data-fb></div>`;
  const line = el.querySelector('[data-line]');
  const bank = el.querySelector('[data-bank]');
  const fb = el.querySelector('[data-fb]');
  const checkBtn = el.querySelector('[data-sb-check]');

  const tile = (t, where) => `<button class="sb-tile" type="button" data-${where}="${t.i}" lang="${lang}">${esc(t.w)}</button>`;

  function draw() {
    const inLine = new Set(placed);
    line.innerHTML = placed.map((i) => tile(tiles[i], 'take')).join('')
      || '<span class="sb-empty">Tap the words below, in order</span>';
    // used tiles keep their space in the bank, so the tiles below don't jump about
    bank.innerHTML = tiles.map((t) => (inLine.has(t.i)
      ? `<span class="sb-tile gone" aria-hidden="true">${esc(t.w)}</span>`
      : tile(t, 'put'))).join('');
    checkBtn.disabled = !placed.length;
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-put],[data-take],[data-sb-check],[data-sb-show],[data-sb-say]');
    if (!b) return;
    if (b.dataset.sbSay !== undefined) return speak?.(sentence);
    if (done) return;
    if (b.dataset.put !== undefined) { placed.push(+b.dataset.put); draw(); }
    else if (b.dataset.take !== undefined) { placed = placed.filter((i) => i !== +b.dataset.take); draw(); }
    else if (b.dataset.sbCheck !== undefined) finish(placed.map((i) => tiles[i].w).join(' ') === sentence);
    else finish(false, true);
  });

  function finish(ok, shown) {
    if (done) return;
    done = true;
    el.querySelectorAll('.sb-tile').forEach((t) => { t.disabled = true; });
    el.querySelector('.sb-tools').hidden = true;
    line.classList.add(ok ? 'right' : 'wrong');
    fb.innerHTML = `<div class="fb ${ok ? 'right' : 'wrong'}">${ok ? '🎉 That’s it' : shown ? '👉 Here’s the sentence' : '❌ Not quite'}
      ${ok ? '' : `<div class="ans" lang="${lang}">${esc(sentence)}</div>`}
      ${speak ? '<div class="sb-say"><button class="tool" type="button" data-sb-say>🔊 Listen</button></div>' : ''}</div>`;
    onDone?.(ok);
  }

  draw();
  return {
    el,
    // let a caller drive it from its own buttons (the app's quiz reuses its Next button)
    check: () => finish(placed.map((i) => tiles[i].w).join(' ') === sentence),
    show: () => finish(false, true),
    get done() { return done; },
  };
}
