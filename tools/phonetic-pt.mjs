// European Portuguese pronunciation, written once per phrase in pt-pronunciation.json (see phrase-table.mjs).
// Unstressed vowels shrink and words run together, so it can't be generated from the spelling.
// The stressed syllable is in CAPITALS.
import { phraseTable } from './phrase-table.mjs';

export const phrasePh = phraseTable('pt-pronunciation.json', { capitals: true });
