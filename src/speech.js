// Text-to-speech, shared by the app and the course pages (build.mjs inlines this file
// into both). Speech runs as a queue of parts — a whole phrase, single words, or letter
// names — and starting a new run cancels the one before it.
//
//   const S = createSpeech({ speech: 'es-ES', code: 'es', language: 'Spanish' });
//   S.speak('Hola');                    // the whole thing
//   S.speak(text, true, el);            // word by word, highlighting each word in el
//   S.speakParts(names, { rate: .6 });  // your own list of parts
//
// onNote is called with a message when the device has no voice for this language, or
// null when it does, so a page can explain why it sounds wrong (or stay quiet).

function createSpeech({ speech, code, language, onNote, onError } = {}) {
  const canSpeak = 'speechSynthesis' in window;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let voice = null;

  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    const norm = (l) => l.replace('_', '-').toLowerCase();
    const want = norm(speech);
    const exact = vs.filter((v) => norm(v.lang) === want);
    // prefer the phone's own (usually better) voice for the exact locale, then any voice for the language
    voice = exact.find((v) => v.localService) || exact[0] || vs.find((v) => norm(v.lang).startsWith(code)) || null;
    // e.g. only a Brazilian voice on the Portuguese site: say so, and how to add the right one
    if (!onNote || !vs.length) return;
    const how = " You can add one in your phone's settings (iPhone: Settings → Accessibility → Spoken Content → Voices).";
    onNote(exact.length ? null
      : voice ? `Your phone doesn't have a ${speech} voice, so it's using ${voice.lang} and may sound different.${how}`
      : `Your phone doesn't have a ${language} voice yet.${how}`);
  }
  if (canSpeak) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }

  let run = 0;
  let undoHighlight = null;

  function stop() {
    run++;
    if (canSpeak) speechSynthesis.cancel();
    undoHighlight?.(); undoHighlight = null;
  }

  function speakParts(parts, opts) {
    stop();
    queueParts(parts, opts);
  }

  // like speakParts, but doesn't stop what's already set up (speak() prepares the highlight first)
  function queueParts(parts, { rate = 0.95, gap = () => 0, onPart } = {}) {
    if (!canSpeak) return onError?.('Speech isn’t available in this browser');
    const mine = run;
    let i = 0;
    const next = () => {
      if (mine !== run) return;
      if (i >= parts.length) { onPart?.(-1); undoHighlight?.(); undoHighlight = null; return; }
      const k = i++;
      onPart?.(k);
      const u = new SpeechSynthesisUtterance(parts[k]);
      u.lang = speech; if (voice) u.voice = voice;
      u.rate = rate;
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(guard); setTimeout(next, gap(k)); };
      // some browsers occasionally never fire onend; don't get stuck
      const guard = setTimeout(finish, 1500 + parts[k].length * 150);
      u.onend = finish; u.onerror = finish;
      speechSynthesis.speak(u);
    };
    next();
  }

  // normal: the whole phrase in one go. slow: word by word with gaps (longer at commas and
  // full stops), highlighting each word in `el` (the phrase on the card) if given
  function speak(text, slow, el) {
    if (!slow) return speakParts([text]);
    const words = String(text).split(/\s+/).filter(Boolean);
    if (words.length < 2) return speakParts(words, { rate: 0.65 });
    stop();
    let onPart;
    if (el) {
      const original = el.innerHTML;
      el.innerHTML = words.map((w, i) => `<span class="w" data-w="${i}">${esc(w)}</span>`).join(' ');
      undoHighlight = () => { el.innerHTML = original; };
      onPart = (k) => el.querySelectorAll('.w').forEach((w, i) => w.classList.toggle('on', i === k));
    }
    queueParts(words, { rate: 0.8, gap: (k) => (/[,.;:!?…]$/.test(words[k]) ? 650 : 320), onPart });
  }

  return { canSpeak, speak, speakParts, queueParts, stop };
}
