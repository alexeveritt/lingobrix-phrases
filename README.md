# Spanish / German / French at Home

Single-page, mobile-first web apps of everyday phrases for families: search, browse by topic, swipe through cards, flashcards and spelling practice.

| Site | Phrases | Built to | Live at |
| --- | --- | --- | --- |
| Spanish at Home | `phrases.json` | `public/` | https://spanish.lingobrix.com |
| German at Home | `phrases.de.json` | `public-de/` | https://german.lingobrix.com |
| French at Home | `phrases.fr.json` | `public-fr/` | https://french.lingobrix.com |

All sites share the same app code, topics and phrase ids.

## Files

| Path | What it is |
| --- | --- |
| `phrases.json`, `phrases.de.json`, `phrases.fr.json` | The phrase lists. **Edit these.** |
| `languages.mjs` | Per-language settings: file names, text, colours, speech voice, accent keys, pronunciation help. |
| `src/index.html` | The app (HTML, CSS and JS in one file). The build fills in `{{…}}`, `/*PHRASES*/` and `/*LANG*/`. |
| `src/_headers` | Cloudflare caching headers, copied into each site. |
| `tools/phonetic.mjs` | Generates Spanish pronunciation from the spelling. |
| `tools/phonetic-de.mjs`, `tools/de-lexicon.json` | German pronunciation, looked up word by word. |
| `tools/phonetic-fr.mjs`, `tools/fr-pronunciation.json` | French pronunciation, written once per phrase (French links words together, so word-by-word doesn't work). |
| `build.mjs` | Regenerates pronunciations, checks the data, writes each site. |
| `public/`, `public-de/`, `public-fr/` | Built sites (committed, and what Cloudflare Pages serves). |

## Editing phrases

Each phrase looks like this (the German and French files use `de` and `fr` in place of `es`):

```json
{ "id": 12, "cat": "morning", "dir": "p", "en": "Time to get up.", "es": "Es hora de levantarse.", "ph": "...", "note": "..." }
```

- `dir`: `p` = parent says it, `t` = teen says it
- `cat`: one of the `categories` ids at the top of the file
- `id`: unique number, and the same id means the same phrase in both languages. Add new phrases with the next free number, and don't reuse ids (practice progress is saved against them).
- `ph`: leave it empty. The build fills it in.
  - Spanish: if a word isn't spelled the Spanish way (a brand or name), add it to `OVERRIDES` in `tools/phonetic.mjs`.
  - German: every word must be in `tools/de-lexicon.json`. The build lists any that are missing. The sound key is in the German site's ⓘ panel.
  - French: every phrase must have an entry in `tools/fr-pronunciation.json`, keyed by its exact French text. If you add a phrase or change its French, the build names the entry to add. The sound key is in the French site's ⓘ panel.

Then rebuild:

```sh
node build.mjs        # both sites
node build.mjs de     # just German (or es, fr)
```

No dependencies are needed, just Node 18 or newer.

## Adding another language

Add an entry to `languages.mjs` (copy the German one), create its phrase file with the same ids, and give it a pronunciation module. Then add a Cloudflare Pages project whose output directory is the new `out` folder.

## Running locally

```sh
# terminal 1: rebuild whenever src/, the phrase files or the lexicon change
node --watch-path=src --watch-path=phrases.json --watch-path=phrases.de.json --watch-path=phrases.fr.json --watch-path=tools build.mjs

# terminal 2: serve a site the same way Cloudflare Pages does (use public-de or public-fr for the others)
npx wrangler pages dev public --ip 0.0.0.0 --port 8788
```

Open http://localhost:8788 on the computer, and refresh after each change. To try it on a phone, connect it to the same Wi-Fi and open `http://<your-computer-ip>:8788` (on a Mac, `ipconfig getifaddr en0` shows the IP).

## Deploying

Each site is its own Cloudflare Pages project (Bytechaser account), connected to this repo with Cloudflare's Git integration. Every push to `main` deploys all of them.

| Setting | Spanish | German | French |
| --- | --- | --- | --- |
| Project name | `spanish-phrases` | `german-phrases` | `french-phrases` |
| Production branch | `main` | `main` | `main` |
| Framework preset | None | None | None |
| Build command | *(empty)* | *(empty)* | *(empty)* |
| Build output directory | `public` | `public-de` | `public-fr` |
| Custom domain | `spanish.lingobrix.com` | `german.lingobrix.com` | `french.lingobrix.com` |

The built folders are committed, so always run `node build.mjs` and commit its output along with any change to the phrases or `src/`.

`_headers` lets browsers cache each page for an hour, then refresh it in the background.
