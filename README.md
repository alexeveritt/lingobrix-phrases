# LingoBrix

Everyday Spanish, German, French and European Portuguese phrases for families with children aged 11–16: search, learn by topic, hear it, flashcards and spelling practice. Each language is a single-file, mobile-first web app.

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
| `src/app.html` | The language app (HTML, CSS and JS in one file). The build fills in `{{…}}`, `/*PHRASES*/` and `/*LANG*/`. |
| `src/home.html` | The lingobrix.com home page. |
| `src/worker.js` | The Cloudflare Worker: hostname → site, `www` redirect, caching headers. |
| `tools/phonetic-es.mjs` | Spanish pronunciation, generated from the spelling. |
| `tools/phonetic-de.mjs` + `de-lexicon.json` | German pronunciation, one entry per word. |
| `tools/phonetic-fr.mjs` + `fr-pronunciation.json` | French pronunciation, one entry per phrase, no capitals (French links words together). |
| `tools/phonetic-pt.mjs` + `pt-pronunciation.json` | European Portuguese pronunciation, one entry per phrase, stress in CAPITALS. |
| `tools/phrase-table.mjs` | Shared lookup and format check for the per-phrase pronunciation files. |
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

No cookies, no tracking, no accounts. Each site stores saved phrases, practice results and settings in the browser's `localStorage` (`lb.v1` on the home page, `sah.v1` / `gah.v1` / `fah.v1` / `pah.v1` on the language sites). The privacy notice is shown once per site.
