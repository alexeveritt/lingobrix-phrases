// Pronunciation stored once per phrase, keyed by the phrase's exact text (used for French and Portuguese,
// where words run together so a word-by-word list can't get it right).
//
// If a phrase is added or its text changes, the build fails until the matching entry is added.
//
//   capitals: false  every syllable lower case (French: no word stress)
//   capitals: true   words of 2+ syllables have exactly one syllable in CAPITALS (the stressed one)
import { readFileSync } from 'node:fs';

const SHAPE = /^[a-zA-Z]+(-[a-zA-Z]+)*,?( [a-zA-Z]+(-[a-zA-Z]+)*,?)*$/;

export function phraseTable(file, { capitals }) {
  const name = `tools/${file}`;
  const table = JSON.parse(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'));

  function valid(ph) {
    if (!SHAPE.test(ph) || ph.endsWith(',')) return false;
    if (!capitals) return ph === ph.toLowerCase();
    return ph.split(' ').every((word) => {
      const syllables = word.replace(/,$/, '').split('-');
      if (syllables.some((s) => s !== s.toLowerCase() && s !== s.toUpperCase())) return false;
      const stressed = syllables.filter((s) => s === s.toUpperCase()).length;
      return syllables.length > 1 ? stressed === 1 : stressed === 0;
    });
  }

  return function phrasePh(text) {
    const ph = table[text];
    if (ph === undefined) throw new Error(`no entry in ${name} for "${text}"`);
    if (!valid(ph)) throw new Error(`bad respelling in ${name}: "${ph}"`);
    return ph;
  };
}
