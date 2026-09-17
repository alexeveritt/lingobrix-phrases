// English-friendly pronunciation for French, stored per phrase in fr-pronunciation.json.
//
// French links words together (vous avez → voo-za-vay), so a word-by-word list can't get it right.
// Each whole phrase is written once, keyed by its exact French text. If a phrase is added or its
// French changes, the build fails until the matching entry is added (see the sound key in the
// French site's ⓘ panel). No capitals: French gives every syllable about the same weight.
import { readFileSync } from 'node:fs';

const FILE = new URL('./fr-pronunciation.json', import.meta.url);
const TABLE = JSON.parse(readFileSync(FILE, 'utf8'));
const VALID = /^[a-z]+(-[a-z]+)*,?( [a-z]+(-[a-z]+)*,?)*$/;

export function phrasePh(text) {
  const ph = TABLE[text];
  if (ph === undefined) throw new Error(`no entry in tools/fr-pronunciation.json for "${text}"`);
  if (!VALID.test(ph) || ph.endsWith(',')) throw new Error(`bad respelling in tools/fr-pronunciation.json: "${ph}"`);
  return ph;
}
