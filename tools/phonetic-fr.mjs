// French pronunciation, written once per phrase in fr-pronunciation.json (see phrase-table.mjs).
// French links words together (vous avez → voo-za-vay) and has no word stress, so no capitals.
import { phraseTable } from './phrase-table.mjs';

export const phrasePh = phraseTable('fr-pronunciation.json', { capitals: false });
