// English-friendly pronunciation for German, looked up word by word in de-lexicon.json.
//
// German spelling doesn't reliably show stress or vowel length, so each word's respelling is
// written once in the lexicon (see the ⓘ panel in the German site for the sound key).
// A phrase that uses a word missing from the lexicon fails the build, naming the word.
import { readFileSync } from 'node:fs';

const LEXICON = JSON.parse(readFileSync(new URL('./de-lexicon.json', import.meta.url), 'utf8'));
const WORD = /[A-Za-zÄÖÜäöüß]+(?:['’-][A-Za-zÄÖÜäöüß]+)*/g;
const VALID = /^[a-zA-Z]+(-[a-zA-Z]+)*$/;

export function wordPh(word) {
  const key = word.toLowerCase().replace(/’/g, "'");
  const ph = LEXICON[key];
  if (ph === undefined) throw new Error(`"${key}" is missing from tools/de-lexicon.json`);
  if (!VALID.test(ph)) throw new Error(`bad respelling for "${key}" in tools/de-lexicon.json: "${ph}"`);
  return ph;
}

export function phrasePh(text) {
  const out = [];
  const missing = [];
  // keep commas so the pronunciation pauses where the German does
  for (const chunk of text.split(/\s+/)) {
    const words = chunk.match(WORD) || [];
    words.forEach((w, i) => {
      try {
        out.push(wordPh(w) + (i === words.length - 1 && /,\W*$/.test(chunk) ? ',' : ''));
      } catch (e) {
        missing.push(e.message);
      }
    });
  }
  if (missing.length) throw new Error(missing.join('; '));
  return out.join(' ');
}
