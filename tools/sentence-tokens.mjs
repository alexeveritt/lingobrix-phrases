// Word-bank tiles for the sentence builder (src/sentence-builder.js).
//
// The build uses these for the course pages and the app uses them for the
// "Build the sentence" practice mode, so a tile looks the same everywhere.

// A tile is the sentence split on spaces, punctuation and all. Joining the tiles
// back together with single spaces gives the sentence again, so an answer can be
// checked exactly — and ¿ … ? staying attached is a useful reminder at A1.
export function sentenceTokens(text) {
  return String(text).normalize('NFC').split(/\s+/).filter(Boolean);
}

// accents and punctuation off, for telling two tiles apart: "Soy" and "soy" are the same tile
const foldWord = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Tiles that don't belong in the answer, taken from other sentences. They're picked
// to be a similar length to the real words, so the answer doesn't stand out by shape.
export function sentenceDistractors(text, corpus, count, rand = Math.random) {
  const answer = sentenceTokens(text);
  const seen = new Set(answer.map(foldWord));
  const avg = answer.reduce((n, w) => n + w.length, 0) / (answer.length || 1);
  const pool = [];
  for (const line of corpus) {
    for (const w of sentenceTokens(line)) {
      const f = foldWord(w);
      if (!f || seen.has(f)) continue;
      seen.add(f);
      pool.push(w);
    }
  }
  return pool
    .map((w) => [Math.abs(w.length - avg) + rand() * 2.5, w])
    .sort((a, b) => a[0] - b[0])
    .slice(0, count)
    .map((x) => x[1]);
}

// Enough extra tiles to make it a real choice, few enough to still fit on a phone.
export function distractorCount(tokens) {
  return Math.max(2, Math.min(5, Math.round(tokens / 2)));
}

// A sentence only works as a tile puzzle if it has enough words to order and not so
// many that the bank fills the screen.
export function buildable(text) {
  const n = sentenceTokens(text).length;
  return n >= 3 && n <= 12;
}
