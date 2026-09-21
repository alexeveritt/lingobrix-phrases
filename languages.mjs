// One entry per language site. build.mjs fills src/app.html with these values and
// writes dist/<code>/index.html; src/worker.js serves it on <subdomain>.lingobrix.com.
//
//   data       phrase file (ids, topics and English are shared across languages)
//   field      the key holding the target-language text in that file
//   subdomain  served at https://<subdomain>.lingobrix.com (also add it to wrangler.jsonc)
import { phrasePh as spanishPh } from './tools/phonetic-es.mjs';
import { phrasePh as germanPh } from './tools/phonetic-de.mjs';
import { phrasePh as frenchPh } from './tools/phonetic-fr.mjs';
import { phrasePh as portuguesePh } from './tools/phonetic-pt.mjs';

export default [
  {
    code: 'es',
    data: 'data/es.json',
    field: 'es',
    subdomain: 'spanish',
    nativeName: 'Español',
    phonetic: spanishPh,
    // Structured courses, built into their own pages under /courses/ (see
    // tools/course.mjs). Leave this off a language and it simply has no courses.
    courses: {
      dir: 'data/courses/es',
      storeKey: 'sac.v1', // keep: course progress lives under this key
      // the link on the app's home screen, kept away from the everyday phrases
      title: 'Advanced study',
      blurb: 'Full courses for adult learners — A1 now, more to come',
      source: 'Instituto Cervantes Elementary 1 and 2 syllabus.',
    },
    page: {
      title: 'Spanish at Home',
      language: 'Spanish',
      shortTitle: 'Spanish',
      description: 'Everyday Spanish phrases for families: search, browse, flashcards and spelling practice.',
      logo: '¡H!',
      // flag stripes for the logo and favicon, top to bottom
      stripes: ['#e5484d', '#f5b82e', '#e5484d'],
      logoInk: '#1f2433',
      logoHalo: 'transparent',
      brand: '#e5484d',
      sun: '#f5b82e',
      hello: '¡Hola!',
      searchExample: 'phone or cena',
      helpIntro: 'Written for English speakers. <b>CAPITALS</b> show which part of the word to stress.',
      helpRows: `
    <tr><td>ah eh ee oh oo</td><td>Spanish vowels are short and clean: <i>ah</i> as in "father", <i>eh</i> as in "bed", <i>ee</i> as in "see", <i>oh</i> as in "hot", <i>oo</i> as in "food".</td></tr>
    <tr><td>th</td><td>Spain's c (before e/i) and z — like "<b>th</b>ink". <i>THEEN-koh</i> = cinco.</td></tr>
    <tr><td>h</td><td>Spanish j, and g before e/i — like an English h but stronger and breathier, from the back of the throat. <i>DEH-hah</i> = deja, <i>KEH-hehs</i> = quejes.</td></tr>
    <tr><td>b</td><td>b and v sound the same, a soft b. <i>BAH-leh</i> = vale.</td></tr>
    <tr><td>y</td><td>ll and y — like "<b>y</b>es". <i>YAH-behs</i> = llaves.</td></tr>
    <tr><td>ny</td><td>ñ — like "ca<b>ny</b>on". <i>mah-NYAH-nah</i> = mañana.</td></tr>
    <tr><td>rr</td><td>A rolled r (rr, or r at the start of a word). A single r is a quick tap, like the tt in American "better".</td></tr>
    <tr><td>(silent)</td><td>A written Spanish h is never sounded: <i>OH-rah</i> = hora.</td></tr>`,
    },
    app: {
      code: 'es',
      speech: 'es-ES',
      flag: '🇪🇸',
      language: 'Spanish',
      storeKey: 'sah.v1', // keep: existing users' saved phrases live under this key
      keys: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'],
      perfect: '¡Perfecto!',
      accentsMsg: 'So close — check the accents (the wavy words)',
      accentsCountAsRight: true,
      checkCapitals: false,
      umlautSpelling: false,
      results: ['¡Increíble! Perfect score', '¡Muy bien! Great work', '¡Bien! Keep going', '¡Ánimo! Practice makes perfect'],
      noMatchExample: '<i>phone</i>, <i>cena</i> or <i>tired</i>',
    },
  },
  {
    code: 'de',
    data: 'data/de.json',
    field: 'de',
    subdomain: 'german',
    nativeName: 'Deutsch',
    phonetic: germanPh,
    page: {
      title: 'German at Home',
      language: 'German',
      shortTitle: 'German',
      description: 'Everyday German phrases for families: search, browse, flashcards and spelling practice.',
      logo: 'H!',
      stripes: ['#1f2433', '#dd3b3b', '#f2c230'],
      logoInk: '#ffffff',
      logoHalo: 'rgba(0,0,0,.6)',
      brand: '#dd3b3b',
      sun: '#f2c230',
      hello: 'Hallo!',
      searchExample: 'phone or Hunger',
      helpIntro: 'Written for English speakers. <b>CAPITALS</b> show which part of the word to stress.',
      helpRows: `
    <tr><td>ah ay ee oh oo</td><td>Long vowels: <i>ah</i> as in "father", <i>ay</i> as in "day", <i>ee</i> as in "see", <i>oh</i> as in "go", <i>oo</i> as in "food". <i>tahk</i> = Tag.</td></tr>
    <tr><td>a e i o u</td><td>Short vowels, quick and clipped: <i>a</i> as in "cat" (but further back), <i>e</i> as in "bed", <i>i</i> as in "sit", <i>o</i> as in "hot", <i>u</i> as in "put".</td></tr>
    <tr><td>uh / er</td><td>A weak, unstressed ending: <i>BI-tuh</i> = bitte, <i>BE-ser</i> = besser (don't say the r).</td></tr>
    <tr><td>ew</td><td>ü — say "ee" with your lips pushed into a tight circle. <i>MEW-duh</i> = müde.</td></tr>
    <tr><td>ur</td><td>ö — like "fur" without the r, lips rounded. <i>shurn</i> = schön.</td></tr>
    <tr><td>eye / oy / ow</td><td>ei, eu/äu and au: <i>mine</i> = mein, <i>HOY-tuh</i> = heute, <i>hows</i> = Haus.</td></tr>
    <tr><td>sh</td><td>The soft ch in ich, nicht, Milch and words ending in -ig. It's really a hiss between "sh" and the h in "huge". <i>ish</i> = ich.</td></tr>
    <tr><td>kh</td><td>The throaty ch after a, o, u and au, like the ch in Scottish "lo<b>ch</b>". <i>bookh</i> = Buch, <i>owkh</i> = auch.</td></tr>
    <tr><td>ts</td><td>German z (and tz) — like the end of "ca<b>ts</b>". <i>tsoo</i> = zu.</td></tr>
    <tr><td>v / f / z</td><td>w sounds like v (<i>vas</i> = was), v usually like f (<i>feel</i> = viel), and s before a vowel like z (<i>ZAH-gen</i> = sagen).</td></tr>
    <tr><td>shp / sht</td><td>sp and st at the start of a word: <i>SHPEE-len</i> = spielen.</td></tr>`,
    },
    app: {
      code: 'de',
      speech: 'de-DE',
      flag: '🇩🇪',
      language: 'German',
      storeKey: 'gah.v1',
      keys: ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'],
      perfect: 'Perfekt!',
      accentsMsg: 'Nearly — check the umlauts (ä ö ü) and ß (the wavy words)',
      accentsCountAsRight: false, // schon and schön are different words
      checkCapitals: true, // German nouns always start with a capital letter
      umlautSpelling: true, // let "muede" match "müde" when searching
      results: ['Super! Perfect score', 'Sehr gut! Great work', 'Gut gemacht! Keep going', 'Weiter so! Practice makes perfect'],
      noMatchExample: '<i>phone</i>, <i>Hunger</i> or <i>tired</i>',
    },
  },
  {
    code: 'fr',
    data: 'data/fr.json',
    field: 'fr',
    subdomain: 'french',
    nativeName: 'Français',
    phonetic: frenchPh,
    page: {
      title: 'French at Home',
      language: 'French',
      shortTitle: 'French',
      description: 'Everyday French phrases for families: search, browse, flashcards and spelling practice.',
      logo: 'H!',
      stripes: ['#2e5bd8', '#ffffff', '#e5484d'],
      vertical: true,
      logoInk: '#1f2433',
      logoHalo: '#ffffff',
      brand: '#2e5bd8',
      sun: '#f5b82e',
      hello: 'Bonjour !',
      searchExample: 'phone or dîner',
      helpIntro: 'Written for English speakers. French gives every syllable about the same weight, with a slight lift at the end of a phrase, so nothing is in capitals. Words that run together are joined with hyphens: <i>voo-za-vay</i> = vous avez.',
      helpRows: `
    <tr><td>a / ay / eh / uh</td><td><i>a</i> as in "cat", <i>ay</i> as in "day" (é, -er, -ez), <i>eh</i> as in "bed" (è, ê, ai), <i>uh</i> the weak e in le, de, je.</td></tr>
    <tr><td>ee / oh / o / oo</td><td><i>ee</i> as in "see", <i>oh</i> as in "go" (au, eau), <i>o</i> as in "hot", <i>oo</i> as in "food" (ou).</td></tr>
    <tr><td>ew</td><td>French u — say "ee" with your lips pushed into a tight circle. <i>tew</i> = tu.</td></tr>
    <tr><td>ur</td><td>eu before a sounded consonant, like "fur" without the r. <i>sur</i> = sœur.</td></tr>
    <tr><td>ohn / ahn / an / uhn</td><td>Nasal vowels (on, an/en, in/ain, un): <b>don't say the n</b> — let the sound come through your nose. <i>bohn</i> = bon, <i>ma-mahn</i> = maman, <i>pan</i> = pain.</td></tr>
    <tr><td>wa / wee</td><td>oi and ui: <i>mwa</i> = moi, <i>nwee</i> = nuit.</td></tr>
    <tr><td>zh</td><td>j, and g before e/i — like the s in "mea<b>s</b>ure". <i>zhuh</i> = je.</td></tr>
    <tr><td>sh / ny</td><td>ch is "sh" (<i>sha</i> = chat); gn is like "ca<b>ny</b>on" (<i>mohn-tany</i> = montagne).</td></tr>
    <tr><td>r</td><td>French r is made at the back of the throat, a bit like a soft gargle.</td></tr>
    <tr><td>(silent)</td><td>h is never said, and most final consonants and final e are silent: <i>puh-tee</i> = petit, <i>tabl</i> = table.</td></tr>`,
    },
    app: {
      code: 'fr',
      speech: 'fr-FR',
      flag: '🇫🇷',
      language: 'French',
      storeKey: 'fah.v1',
      keys: ['é', 'è', 'ê', 'à', 'ç', 'â', 'î', 'ô', 'û', 'ù', 'ë', 'œ'],
      perfect: 'Parfait !',
      accentsMsg: 'Nearly — check the accents (the wavy words)',
      accentsCountAsRight: false, // ou/où and a/à are different words
      checkCapitals: false,
      umlautSpelling: false,
      results: ['Incroyable ! Perfect score', 'Très bien ! Great work', 'Bien joué ! Keep going', 'Courage ! Practice makes perfect'],
      noMatchExample: '<i>phone</i>, <i>dîner</i> or <i>tired</i>',
    },
  },
  {
    code: 'pt',
    data: 'data/pt.json',
    field: 'pt',
    subdomain: 'portuguese',
    nativeName: 'Português (Portugal)',
    phonetic: portuguesePh,
    page: {
      title: 'Portuguese at Home',
      language: 'Portuguese',
      shortTitle: 'Portuguese',
      description: 'Everyday European Portuguese phrases for families: search, browse, flashcards and spelling practice.',
      logo: 'H!',
      // Portugal's flag: green then red
      stripes: ['#1b7f47', '#1b7f47', '#e5484d'],
      vertical: true,
      logoInk: '#ffffff',
      logoHalo: 'rgba(0,0,0,.55)',
      brand: '#1b7f47',
      sun: '#f5c518',
      hello: 'Olá!',
      searchExample: 'phone or jantar',
      helpIntro: 'Written for English speakers, using the accent from <b>Portugal</b> (not Brazil). <b>CAPITALS</b> show which part of the word to stress. Unstressed vowels are very short or silent, so words sound shorter than they look.',
      helpRows: `
    <tr><td>ah / uh</td><td>Stressed a is <i>ah</i> as in "father"; unstressed a is a short <i>uh</i>. <i>KAH-zuh</i> = casa.</td></tr>
    <tr><td>eh / ay / uh</td><td>Open é is <i>eh</i> as in "bed", closed ê is <i>ay</i> as in "day", and unstressed e is a tiny <i>uh</i> or disappears: <i>noyt</i> = noite.</td></tr>
    <tr><td>ee / o / oh / oo</td><td><i>ee</i> as in "see", <i>o</i> as in "hot" (ó), <i>oh</i> as in "go" (ô, ou), and unstressed o is <i>oo</i>: <i>oh-bree-GAH-doo</i> = obrigado.</td></tr>
    <tr><td>sh / zh</td><td>s at the end of a word or before a consonant sounds like "sh" — a big Portugal sound: <i>doysh</i> = dois, <i>sh-TOH</i> = estou. j and g before e/i are "zh", like the s in "mea<b>s</b>ure": <i>zhah</i> = já.</td></tr>
    <tr><td>own / ayn / oyn</td><td>Nasal sounds (ão, ãe, õe): <b>don't say the n</b> — let the sound come through your nose. <i>nown</i> = não, <i>mayn</i> = mãe, <i>kaynsh</i> = cães.</td></tr>
    <tr><td>ahn / an / een / ohn / oon</td><td>Other nasal vowels (am/an, em, im/in, om/on, um/un), again without really saying the n: <i>bohn</i> = bom, <i>seen</i> = sim.</td></tr>
    <tr><td>ly / ny</td><td>lh is like the "lli" in "million" (<i>FEE-lyoo</i> = filho); nh is like "ca<b>ny</b>on" (<i>muh-NYAHN</i> = manhã).</td></tr>
    <tr><td>rr / r</td><td><i>rr</i> (rr, or r at the start of a word) is a throaty sound at the back of the mouth; a single r between vowels is a quick tap.</td></tr>
    <tr><td>t / d</td><td>Always a plain t and d — never the "ch"/"j" sound you hear in Brazil: <i>tard</i> = tarde.</td></tr>
    <tr><td>(silent)</td><td>h is never said: <i>ohzh</i> = hoje.</td></tr>`,
    },
    app: {
      code: 'pt',
      speech: 'pt-PT', // a Brazilian voice is only used if the phone has no Portugal voice
      flag: '🇵🇹',
      language: 'Portuguese',
      storeKey: 'pah.v1',
      keys: ['á', 'à', 'â', 'ã', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú', 'ç'],
      perfect: 'Perfeito!',
      accentsMsg: 'Nearly — check the accents (the wavy words)',
      accentsCountAsRight: false, // avó and avô are different people
      checkCapitals: false,
      umlautSpelling: false,
      results: ['Incrível! Perfect score', 'Muito bem! Great work', 'Boa! Keep going', 'Força! Practice makes perfect'],
      noMatchExample: '<i>phone</i>, <i>jantar</i> or <i>tired</i>',
    },
  },
];
