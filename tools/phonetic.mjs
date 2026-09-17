// Generates an English-friendly pronunciation guide for Spain (Castilian) Spanish.
//
//   levántate      -> leh-BAHN-tah-teh
//   zapatos        -> thah-PAH-tohs     (c/z = "th", as in Spain)
//   déjalo         -> DEH-hah-loh       (j / soft g = "h", said strongly from the throat)
//   llaves         -> YAH-behs          (ll = "y", b and v both = "b")
//
// Vowels are always spelled the same way: ah, eh, ee, oh, oo.
// CAPITALS mark the stressed syllable. One-syllable words stay lower case.

// Words that aren't spelled the Spanish way (brands, names, borrowed words).
export const OVERRIDES = {
  pizza: 'PEET-sah',
  pizzas: 'PEET-sahs',
  wifi: 'WEE-fee',
  monty: 'MOHN-tee',
  facetime: 'FAYS-taym',
  "mcdonald's": 'mahk-DOH-nahlds',
  netflix: 'NEHT-fleeks',
  youtube: 'YOO-toob',
  whatsapp: 'wah-TSAHP',
  instagram: 'EENS-tah-grahm',
  tiktok: 'teek-TOHK',
  playstation: 'PLAY-stay-shohn',
  xbox: 'EHKS-bohks',
  ok: 'oh-KAY',
  sándwich: 'SAHN-gweech',
  sándwiches: 'SAHN-gwee-chehs',
  kétchup: 'KEH-chup',
  bluetooth: 'BLOO-toos',
  online: 'ohn-LAYN',
  selfie: 'SEHL-fee',
  ipad: 'AY-pahd',
  iphone: 'AY-fohn',
  email: 'EE-mayl',
  vlog: 'blohg',
  y: 'ee',
};

const VOWELS = 'aeiouáéíóúü';
const ACCENTED = 'áéíóú';
const PLAIN = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' };
const isVowel = (ch) => !!ch && VOWELS.includes(ch);
const soft = (ch) => !!ch && 'eéií'.includes(ch);

// Break a word into sound units: {c: sound} for consonants, {v: letter} for vowels.
function units(w) {
  const out = [];
  for (let i = 0; i < w.length; i++) {
    const ch = w[i], nx = w[i + 1], prev = w[i - 1];
    if (ch === 'c' && nx === 'h') { out.push({ c: 'ch' }); i++; continue; }
    if (ch === 'l' && nx === 'l') { out.push({ c: 'y' }); i++; continue; }
    if (ch === 'r' && nx === 'r') { out.push({ c: 'rr' }); i++; continue; }
    if (ch === 'q' && nx === 'u') { out.push({ c: 'k' }); i++; continue; }
    if (ch === 'g' && nx === 'u' && soft(w[i + 2])) { out.push({ c: 'g' }); i++; continue; }
    if (isVowel(ch)) { out.push({ v: ch }); continue; }
    switch (ch) {
      case 'g': out.push({ c: soft(nx) ? 'h' : 'g' }); break;
      case 'c': out.push({ c: soft(nx) ? 'th' : 'k' }); break;
      case 'z': out.push({ c: 'th' }); break;
      case 'j': out.push({ c: 'h' }); break;
      case 'v': out.push({ c: 'b' }); break;
      case 'ñ': out.push({ c: 'ny' }); break;
      case 'x': out.push({ c: 'ks' }); break;
      case 'h': out.push({ c: '' }); break; // silent (a written h is never sounded; the "h" in the output is j / soft g)
      case 'r': out.push({ c: i === 0 || 'nls'.includes(prev) ? 'rr' : 'r' }); break;
      case 'y':
        // consonant before a vowel ("ya", "desayuno"), otherwise a vowel ("hoy", "muy")
        out.push(isVowel(nx) ? { c: 'y' } : { v: 'i', y: true });
        break;
      default:
        if (!/[a-z]/.test(ch)) throw new Error(`Unexpected character "${ch}" in "${w}"`);
        out.push({ c: ch });
    }
  }
  return out;
}

const strong = (v) => 'aeoáéóíú'.includes(v); // accented i/u break a diphthong, so count as strong
const INSEPARABLE = new Set(['pl', 'pr', 'bl', 'br', 'fl', 'fr', 'gl', 'gr', 'kl', 'kr', 'tl', 'tr', 'dr']);

function syllables(us) {
  // group vowel runs into nuclei, splitting two strong vowels (hiatus)
  const parts = []; // alternating arrays of consonants and nuclei
  let cons = [];
  let nuc = null;
  for (const u of us) {
    if (u.c !== undefined) {
      if (nuc) { parts.push({ n: nuc }); nuc = null; }
      cons.push(u.c);
    } else {
      if (nuc) {
        const last = nuc[nuc.length - 1];
        if (strong(last.v) && strong(u.v)) { parts.push({ n: nuc }); nuc = null; }
      }
      if (!nuc) { parts.push({ k: cons }); cons = []; nuc = []; }
      nuc.push(u);
    }
  }
  if (nuc) parts.push({ n: nuc });
  const tail = cons;

  const sylls = [];
  let onset = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.k) {
      if (!sylls.length) { onset = p.k.filter(Boolean); continue; }
      const k = p.k;
      let split; // how many consonants stay with the previous syllable
      const pair = (a, b) => INSEPARABLE.has(a + b);
      if (k.length <= 1) split = 0;
      else if (k.length === 2) split = pair(k[0], k[1]) ? 0 : 1;
      else if (k.length === 3) split = pair(k[1], k[2]) ? 1 : 2;
      else split = 2;
      sylls[sylls.length - 1].coda.push(...k.slice(0, split));
      onset = k.slice(split);
    } else {
      sylls.push({ onset, nuc: p.n, coda: [] });
      onset = [];
    }
  }
  if (sylls.length) sylls[sylls.length - 1].coda.push(...tail);
  return sylls;
}

const SINGLE = { a: 'ah', e: 'eh', i: 'ee', o: 'oh', u: 'oo' };
const GROUP = {
  ia: 'yah', ie: 'yeh', io: 'yoh', iu: 'yoo',
  ua: 'wah', ue: 'weh', uo: 'woh', ui: 'wee',
  ai: 'eye', ei: 'ay', oi: 'oy', au: 'ow', eu: 'eh-oo', ou: 'oh',
  uai: 'wye', uei: 'way', iai: 'yeye', iei: 'yay',
};

function renderNucleus(nuc) {
  const s = nuc.map((u) => PLAIN[u.v] || u.v).join('');
  return GROUP[s] || [...s].map((c) => SINGLE[c]).join('');
}

export function wordPh(word) {
  const w = word.toLowerCase().replace(/’/g, "'");
  if (OVERRIDES[w] !== undefined) return OVERRIDES[w];
  const us = units(w);
  const sy = syllables(us);
  if (!sy.length) throw new Error(`No vowels in "${word}"`);

  let stress = sy.findIndex((s) => s.nuc.some((u) => ACCENTED.includes(u.v)));
  if (stress < 0) {
    const last = w[w.length - 1];
    stress = sy.length > 1 && 'aeiouns'.includes(last) ? sy.length - 2 : sy.length - 1;
  }

  const out = sy.map((s) => ({
    onset: s.onset.filter(Boolean).join(''),
    body: renderNucleus(s.nuc),
    coda: s.coda.filter(Boolean).join(''),
  }));
  // "examen": keep the k of an x with the syllable before -> ehk-SAH-mehn
  out.forEach((s, i) => {
    if (s.onset.startsWith('ks')) {
      if (i > 0) out[i - 1].coda += 'k';
      s.onset = s.onset.slice(1);
    }
  });
  return out
    .map((s, i) => {
      const t = s.onset + s.body + s.coda;
      return sy.length > 1 && i === stress ? t.toUpperCase() : t;
    })
    .join('-');
}

export function phrasePh(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const comma = /[,;:]$/.test(tok.replace(/[.!?¡¿…"'“”‘’»«)]+$/, '')) ? ',' : '';
      const core = tok.replace(/^[¿¡"'“‘«(]+|[.,;:!?¡¿…"'”’»)]+$/g, '');
      if (!core) return '';
      return wordPh(core) + comma;
    })
    .filter(Boolean)
    .join(' ');
}
