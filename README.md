# Spanish at Home

A single-page, mobile-first web app of everyday Spain Spanish phrases for families: search, browse by topic, swipe through cards, flashcards and spelling practice.

## Files

| Path | What it is |
| --- | --- |
| `phrases.json` | The phrase list. **Edit this.** |
| `src/index.html` | The app (HTML, CSS and JS in one file). The phrases get injected at `/*PHRASES*/`. |
| `tools/phonetic.mjs` | Generates the English-friendly pronunciation (Spain accent) from the Spanish. |
| `build.mjs` | Regenerates pronunciations, checks the data, writes `public/index.html`. |
| `public/` | What gets deployed: `index.html` (everything inlined) and `_headers`. |

## Editing phrases

Each phrase in `phrases.json` looks like this:

```json
{ "id": 12, "cat": "morning", "dir": "p", "en": "Time to get up.", "es": "Es hora de levantarse.", "ph": "...", "note": "..." }
```

- `dir`: `p` = parent says it, `t` = teen says it
- `cat`: one of the `categories` ids at the top of the file
- `id`: unique number. Add new phrases with the next free number, and don't reuse ids (practice progress is saved against them).
- `ph`: leave it empty. The build fills it in. If a word isn't spelled the Spanish way (a brand or name), add it to `OVERRIDES` in `tools/phonetic.mjs`.

Then rebuild:

```sh
node build.mjs
```

No dependencies are needed, just Node 18 or newer.

## Running locally

```sh
# terminal 1: rebuild whenever src/ or phrases.json changes
node --watch-path=src --watch-path=phrases.json build.mjs

# terminal 2: serve it the same way Cloudflare Pages does (with _headers)
npx wrangler pages dev public --ip 0.0.0.0 --port 8788
```

Open http://localhost:8788 on the computer, and refresh after each change. To try it on a phone, connect it to the same Wi-Fi and open `http://<your-computer-ip>:8788` (on a Mac, `ipconfig getifaddr en0` shows the IP).

## Deploying

Hosted on Cloudflare Pages (Bytechaser account) at https://spanish.lingobrix.com. The project uses Cloudflare's Git integration: every push to `main` deploys to production, and pushes to other branches get preview URLs.

Pages build settings:

- Framework preset: None
- Build command: *(empty)*, because `public/` is committed
- Build output directory: `public`
- Production branch: `main`

So always run `node build.mjs` and commit `public/index.html` along with any change to `phrases.json` or `src/`.

`public/_headers` lets browsers cache the page for an hour, then refresh it in the background.
