# LingoBrix

Everyday Spanish, German, French and European Portuguese phrases for families with children aged 11–16: search, learn by topic, hear it, flashcards, sentence building and spelling practice. Each language is a single-file, mobile-first web app.

Spanish also has **courses** at `/courses/` — a separate set of static pages for adult learners, kept away from the everyday phrases and reached from *Advanced study* on the home screen. The first is an A1 refresh (A1.1 and A1.2), one page per syllabus section.

| Site | Serves |
| --- | --- |
| https://lingobrix.com | Home page with a language picker (`www.` redirects here) |
| https://spanish.lingobrix.com | Spanish app |
| https://german.lingobrix.com | German app |
| https://french.lingobrix.com | French app |
| https://portuguese.lingobrix.com | European Portuguese app (Portugal, not Brazil) |

All of them are served by one Cloudflare Worker, which picks the site from the hostname. Every language shares the same app code, topics and phrase ids.

## Layout

| Path | What it is |
| --- | --- |
| `data/es.json`, `de.json`, `fr.json`, `pt.json` | The phrase lists. **Edit these.** |
| `data/alphabet/<code>.json` | Alphabet & spelling page: letter names (and other names in use), accents, spelling phrases and 40 practice words taken from the phrases. |
| `languages.mjs` | Per-language settings: data file, subdomain, text, colours, speech voice, accent keys, pronunciation help. |
| `data/courses/<code>/` | The courses: `courses.json` lists them, then one folder per course. **Edit these.** |
| `src/app.html` | The language app (HTML, CSS and JS in one file). The build fills in `{{…}}`, `/*CSS*/`, `/*SHARED*/`, `/*PHRASES*/` and `/*LANG*/`. |
| `src/base.css` | The styles, shared by the app and the course pages. |
| `src/course.css`, `src/course-page.html`, `src/course.js` | The course pages: extra styles, the page shell, and the browser side. |
| `src/speech.js` | Text-to-speech, shared by the app and the course. |
| `src/sentence-builder.js` | The tap-the-words-in-order puzzle, shared by the app and the course. |
| `src/home.html` | The lingobrix.com home page. |
| `src/worker.js` | The Cloudflare Worker: hostname → site, `www` redirect, caching headers. |
| `tools/phonetic-es.mjs` | Spanish pronunciation, generated from the spelling. |
| `tools/phonetic-de.mjs` + `de-lexicon.json` | German pronunciation, one entry per word. |
| `tools/phonetic-fr.mjs` + `fr-pronunciation.json` | French pronunciation, one entry per phrase, no capitals (French links words together). |
| `tools/phonetic-pt.mjs` + `pt-pronunciation.json` | European Portuguese pronunciation, one entry per phrase, stress in CAPITALS. |
| `tools/phrase-table.mjs` | Shared lookup and format check for the per-phrase pronunciation files. |
| `tools/course.mjs` | Checks the courses and renders their pages. |
| `tools/sentence-tokens.mjs` | The tiles and distractor words for the sentence builder. |
| `build.mjs` | Checks the data, regenerates pronunciations and builds everything into `dist/`. |
| `tests/` | `worker.test.mjs` (routing) and `smoke.mjs` (clicks through every site in Chrome). |
| `wrangler.jsonc` | Worker config, including the custom domains. |

`dist/` is built output and isn't committed. Cloudflare builds it on every push.

## Commands

Needs Node 20+. Run `npm install` once.

```sh
npm run build   # build everything into dist/ (node build.mjs de builds just German)
npm run watch   # rebuild whenever data/, src/, tools/ or languages.mjs change
npm run dev     # build, then serve at http://localhost:8787 (and on your Wi-Fi)
npm test        # build, test the Worker routing, then click through every site in Chrome
```

`npm run dev` serves the home page at `/`, and the language apps at `/es/`, `/de/`, `/fr/` and `/pt/`. To try it on a phone, connect it to the same Wi-Fi and open `http://<your-computer-ip>:8787` (on a Mac, `ipconfig getifaddr en0` shows the IP). Refresh after each rebuild.

`npm test` uses your installed Google Chrome (through `playwright-core`), so no browsers are downloaded.

## Editing phrases

Each phrase looks like this (the other files use `de`, `fr` and `pt` in place of `es`):

```json
{ "id": 12, "cat": "morning", "dir": "p", "en": "Time to get up.", "es": "Es hora de levantarse.", "ph": "...", "note": "..." }
```

- `dir`: `p` = a parent says it, `t` = a kid says it
- `cat`: one of the `categories` ids at the top of the file
- `id`: unique, and the same id means the same phrase in every language. Add new phrases with the next free number and never reuse ids (practice progress is saved against them).
- `ph`: leave it empty. The build fills it in.
  - Spanish: if a word isn't spelled the Spanish way (a brand or name), add it to `OVERRIDES` in `tools/phonetic-es.mjs`.
  - German: every word must be in `tools/de-lexicon.json`. The build lists any that are missing.
  - French and Portuguese: every phrase must be in `tools/fr-pronunciation.json` / `pt-pronunciation.json`, keyed by its exact text. The build names any that are missing.
  - Portuguese is European Portuguese: telemóvel, cão, casa de banho, `tu` with its own verb forms, `estar a` + verb.
  - The sound keys are in each site's ⓘ panel.

Then run `npm test`, commit and push. The build fails, and nothing deploys, if a phrase is incomplete.

## Alphabet & spelling

Each app has an **Alphabet & spelling** page (linked from its home screen): tap a letter to hear its name and see an example, "Spell it out" reads any name or word letter by letter, and two practice modes (listen and write, spell it aloud) use the `words` list.

The build checks each `data/alphabet/<code>.json`: every letter a–z is listed, every letter or accent used in the phrases has a spoken name, and every practice word appears in the phrases. Spanish pronunciations are generated; the others are written by hand in the same style as the phrases.

## Courses

Spanish has courses under `/courses/`, built from `data/courses/es/`:

| File | What it is |
| --- | --- |
| `courses.json` | Which courses this language has: a `slug` (its URL) and a `dir` for each. An entry with a `title` but no `dir` is shown as a placeholder, for a course you haven't written yet. |
| `a1/course.json` | One course: its title, short title (used in breadcrumbs and the nav), the list of levels (`id`, `slug`, `file`) and what the whole course builds up to. |
| `a1/a1-1.json`, `a1/a1-2.json` | One file per level: its `sections`, each with an `id`, a `slug` (its URL), patterns, examples, a free-form `reference`, common mistakes, practice prompts and checkpoints. |

The build turns that into finished HTML, so every page works with no JavaScript and can be cached hard:

```
/courses/                                  every course, with progress
/courses/a1/                               one course: its levels, search, what it builds up to
/courses/a1/a1-1/                          one level: its sections, filters, level-wide practice
/courses/a1/a1-1/greetings-farewells/      one section
/courses/a1/data/a1-1.json                 the whole level, fetched only for search and level-wide practice
/courses/assets/course.<hash>.css|js       shared by every page, named after their contents
```

Every page carries the same bottom nav — **Home** (back to the phrase app), **Courses**, then the course and level it sits in — plus a breadcrumb. `tools/course.mjs` builds those links off `up`, the way back to `/courses/`, so they stay right at any depth.

A section page is split into **Learn**, **Examples**, **Reference** and **Practise** tabs rather than one long scroll. The tabs are radio inputs styled with CSS, so they still work with JavaScript off, and a tab with nothing in it isn't rendered.

To add a level, drop a new file next to the others and add it to `levels` in `course.json`. To add a course (A2 and so on), add a folder and an entry in `courses.json`. To give another language courses, add a `courses` block to its entry in `languages.mjs`.

### Progress

Progress is earned rather than declared, and kept in `localStorage` under `sac.v1`:

- answering a question in practice marks that section **practised** (once per round, credited as you answer, so backing out part-way still counts)
- one tap on *I'm happy with this section* marks it **refreshed**, which is what the progress bars count
- a round from a single section scoring 80% or more offers to mark it refreshed there and then

The `checkpoints` in the data are shown read-only, as a "happy with all of this?" prompt for deciding whether to mark a section off — they're not a tick list. The course-wide `globalCheckpoints` are shown the same way.

`reference` is deliberately free-form — each section shapes it differently — and `tools/course.mjs` renders each value by what it is: a note, a list of words, a conjugation table (when the rows line up with `subjectOrder`), minimal pairs, or a set of contrasts. A shape it doesn't recognise is still shown rather than dropped.

Spanish pronunciations are generated for examples and patterns wherever the text is plain enough for `tools/phonetic-es.mjs`; anything with digits, `@` or `/` in it simply has none.

## Sentence building

`src/sentence-builder.js` is the tap-the-words-in-order puzzle. It's used in two places from one copy of the code: the course pages, and the app's **🧱 Build the sentence** practice mode.

A tile is the sentence split on spaces, punctuation and all, so joining the tiles back together with single spaces gives the sentence again and an answer can be checked exactly. The extra words come from other sentences in the same set, picked to be a similar length so the answer doesn't stand out by shape. Sentences of 3–12 words get a puzzle; the app hides the mode for anything shorter.

## Adding a language

1. Add an entry to `languages.mjs` (copy an existing one) with a new `code` and `subdomain`.
2. Create `data/<code>.json` with the same ids, `data/alphabet/<code>.json`, and a pronunciation module in `tools/`.
3. Add `{ "pattern": "<subdomain>.lingobrix.com", "custom_domain": true }` to `routes` in `wrangler.jsonc`.
4. Add a search word for it in `tests/smoke.mjs`, then `npm test`.

The home page and the Worker pick up the new language automatically.

## Deploying

The Worker is called `lingobrix`, in the Bytechaser Cloudflare account. It's connected to this GitHub repo with Workers Builds:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` (preview URLs for other branches) |
| Root directory | *(empty)* |

Every push to `main` builds and deploys all sites. The Worker's name in the dashboard must match `name` in `wrangler.jsonc`.

Custom domains are set by `routes` in `wrangler.jsonc` and created on deploy. A hostname can only be added when nothing else uses it: no existing DNS record, and not attached to a Pages project.

Pages load with `Cache-Control: public, max-age=3600, stale-while-revalidate=604800`, so a phone may show the previous version once before picking up a new one.

## Privacy

No cookies, no tracking, no accounts. Each site stores saved phrases, practice results and settings in the browser's `localStorage` (`lb.v1` on the home page, `sah.v1` / `gah.v1` / `fah.v1` / `pah.v1` on the language sites, and `sac.v1` for Spanish course progress). The privacy notice is shown once per site.
