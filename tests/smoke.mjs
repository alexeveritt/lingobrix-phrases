// Browser smoke test for the built sites in dist/ (run: npm test).
//
// Opens each page in your installed Google Chrome, emulating an iPhone, and clicks through
// the main features. Uses playwright-core, so no browsers are downloaded.
//
//   npm test                 all sites
//   node tests/smoke.mjs de  just German (after npm run build)
import { chromium, devices } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve, join, normalize, extname } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import languages from '../languages.mjs';

const only = process.argv.slice(2);
const SEARCH = { es: 'móvil', de: 'Handy', fr: 'portable', pt: 'telemóvel' };
const pageUrl = (path) => pathToFileURL(resolve('dist', path, 'index.html')).href;

// The course pages fetch their level file, which file:// won't allow, so dist/ is also
// served over HTTP for those checks.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join('dist', normalize(path)));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: 'chrome' });
let failures = 0;

async function run(name, fn) {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const check = async (label, test) => {
    try {
      const result = await test(page);
      if (result === false) throw new Error('returned false');
      console.log(`  ok   ${label}`);
    } catch (e) {
      failures++;
      console.log(`  FAIL ${label}: ${e.message.split('\n')[0]}`);
    }
  };
  console.log(name);
  try {
    await fn(page, check);
  } catch (e) {
    failures++;
    console.log(`  FAIL stopped early: ${e.message.split('\n')[0]}`);
  }
  if (errors.length) {
    failures++;
    console.log(`  FAIL JavaScript errors: ${errors.join(' | ')}`);
  }
  await context.close();
}

const visible = (sel) => async (page) => page.locator(sel).isVisible();
const count = (sel, min = 1) => async (page) => (await page.locator(sel).count()) >= min;

if (!only.length) {
  await run('home', async (page, check) => {
    await page.goto(pageUrl('.'));
    await check('privacy notice shows', visible('#welcome'));
    await page.click('#welcomeOk');
    await page.reload();
    await check('notice stays closed', async (p) => !(await p.locator('#welcome').isVisible()));
    await check(`a card for each language (${languages.length})`, count('.lang', languages.length));
    await check('cards link to the local sites away from lingobrix.com', async (p) =>
      (await p.getAttribute('.lang >> nth=0', 'href')) === `/${languages[0].code}/`);
  });
}

for (const lang of languages) {
  if (only.length && !only.includes(lang.code)) continue;
  await run(`${lang.page.title} (${lang.code})`, async (page, check) => {
    await page.goto(pageUrl(lang.code));
    await check('welcome popup with icon picker', count('#welcome [data-icon]', 5));
    await page.click('#welcome [data-icon="⚽"]');
    await page.click('#welcomeOk');

    await check('header shows the language flag', async (p) => (await p.textContent('#langBtn')).trim() === lang.app.flag);
    await page.click('#langBtn');
    await check('switcher lists every language, this one marked', async (p) =>
      (await p.locator('#langList .choice').count()) === languages.length &&
      (await p.textContent('#langList [aria-current]')).includes(lang.page.language));
    await check('switcher links to the other languages and home', async (p) => {
      const hrefs = await p.$$eval('#langList a', (as) => as.map((a) => a.getAttribute('href')));
      const others = languages.filter((l) => l.code !== lang.code).map((l) => `/${l.code}/`);
      return JSON.stringify(hrefs) === JSON.stringify(others) && (await p.getAttribute('#langs [data-home]', 'href')) === '/';
    });
    await page.click('#langs [data-close-sheet]');
    await check('switcher closes', async (p) => !(await p.locator('#langs').isVisible()));
    await check('home screen has a switch-language link', visible('.more [data-open-langs]'));

    await page.fill('#q', SEARCH[lang.code]);
    await page.waitForSelector('#results .row', { timeout: 3000 }).catch(() => {}); // search waits for a pause in typing
    await check(`search "${SEARCH[lang.code]}" finds phrases`, count('#results .row', 3));
    await check('rows show a › so they look tappable', count('#results .row .go', 3));
    await check('list tip shows', visible('#results [data-tip="tap"]'));
    await page.locator('#results .row').first().click();
    await check('card opens', visible('#viewer'));
    await check('first card shows the swipe tip and nudges', async (p) =>
      (await p.locator('#vTip [data-tip="swipe"]').isVisible()) && (await p.locator('#stage .card.peek').count()) === 1);
    await page.click('#vTip [data-tip="swipe"]');
    await check('Got it hides the tip', async (p) => (await p.locator('#vTip .tip').count()) === 0);
    await check('card has a pronunciation', async (p) => (await p.textContent('#stage .ph')).trim().length > 0);
    await page.click('#vNext');
    await page.waitForTimeout(400);
    await check('next card', async (p) => (await p.textContent('#vCount')).startsWith('2 /'));
    await page.click('#vCover [data-c="1"]');
    await check('hide the language', count('#stage .covered .tx'));
    await page.click('#stage .covered');
    await check('tap to reveal', async (p) => (await p.locator('#stage .covered').count()) === 0);
    await page.click('#vCover [data-c="0"]');
    await page.goBack();
    await check('back closes the cards', async (p) => !(await p.locator('#viewer').isVisible()));
    await check('list tip remembered after a card was opened', async (p) => (await p.locator('#results [data-tip="tap"]').count()) === 1);
    await page.click('#results [data-tip="tap"]');
    await page.locator('#results .row').first().click();
    await check('next time the cards show the next tip', visible('#vTip [data-tip="listen"]'));
    await page.goBack();

    await page.fill('#q', '');
    await page.click('.choice[data-href="#alphabet"]');
    await check('alphabet page lists every letter', count('.abc-grid .abc', 26));
    await page.locator('.abc-grid .abc').nth(2).click();
    await check('tapping a letter shows its name and an example', async (p) =>
      (await p.locator('#abcSheet').isVisible()) && (await p.textContent('#abcSheetBody h3')).trim().length > 0);
    await page.click('#abcSheet [data-close-sheet]');
    await page.fill('#spellIn', 'Sam Lee');
    await page.click('#spellGo');
    await check('spell it out shows each letter with its name', async (p) =>
      (await p.locator('#spellOut span:not(.gap)').count()) === 6 && (await p.locator('#spellOut span.gap').count()) === 1);
    await page.click('#spellListen');
    const words = await page.evaluate(() => JSON.parse(document.getElementById('abc').textContent).words.map((w) => w.tx));
    await check('listen and write asks for a practice word', visible('#tIn'));
    await page.waitForTimeout(600); // the word is spelled out just after the question appears
    const secret = await page.evaluate(() => [...document.querySelectorAll('#spHidden b')].map((b) => b.textContent).join(''));
    await check('the hidden word is one of the practice words', async () => words.includes(secret));
    await page.fill('#tIn', secret);
    await page.click('#tCheck');
    await check('typing the spelled word is right', async (p) => (await p.getAttribute('.fb', 'class')).includes('right'));
    await page.click('#quiz [data-close]');
    await page.click('#spellSay');
    await page.click('#flip .prompt');
    await check('spell it aloud reveals the letters', count('#spShown span', 2));
    await page.click('#fcAns [data-a="1"]');
    await page.click('#quiz [data-close]');

    await page.click('[data-tab=topics]');
    await check('topic tiles', count('.tile', 10));
    await page.locator('.tile').nth(2).click();
    await check('kid tab uses the picked icon', async (p) => (await p.textContent('[data-side="t"]')).includes('⚽ Kid says'));
    await page.click('[data-side="t"]');
    await page.click('#tTest');
    await check('Test me keeps the kid tab', async (p) => (await p.inputValue('#pTopic')).endsWith(':t'));

    await page.click('#pMode [data-v=type]');
    await page.click('#pStart');
    await check('spelling shows the special-letters tip', visible('#qBody [data-tip="keys"]'));
    const answers = await page.evaluate(() =>
      Object.fromEntries(JSON.parse(document.getElementById('data').textContent).phrases.map((p) => [p.en, p.tx])));
    const answer = answers[(await page.textContent('#qBody .big')).trim()];
    await page.fill('#tIn', answer);
    await page.keyboard.press('Enter');
    await check('typing the right answer', async (p) => (await p.getAttribute('.fb', 'class')).includes('right'));
    await page.keyboard.press('Enter');
    await page.fill('#tIn', 'xyz');
    await page.keyboard.press('Enter');
    await check('typing a wrong answer', async (p) => (await p.getAttribute('.fb', 'class')).includes('wrong'));
    await page.click('#quiz [data-close]');

    await page.click('#pMode [data-v=build]');
    await page.click('#pStart');
    await check('build mode deals out a word bank', count('.sb-bank .sb-tile', 4));
    // the same English can have more than one right answer, so find the one these tiles spell
    const target = await page.evaluate(() => {
      const en = document.querySelector('.sb-prompt').textContent;
      const bank = [...document.querySelectorAll('.sb-bank .sb-tile')].map((b) => b.textContent);
      return JSON.parse(document.getElementById('data').textContent).phrases
        .filter((p) => p.en === en)
        .map((p) => p.tx)
        .find((tx) => {
          const left = bank.slice();
          return tx.split(/\s+/).every((w) => {
            const i = left.indexOf(w);
            if (i < 0) return false;
            left.splice(i, 1);
            return true;
          });
        }) || null;
    });
    await check('the bank holds a real answer to the prompt', () => !!target);
    for (const word of (target || '').split(/\s+/).filter(Boolean)) {
      await page.evaluate((w) => {
        [...document.querySelectorAll('.sb-bank .sb-tile')].find((x) => !x.classList.contains('gone') && x.textContent === w).click();
      }, word);
    }
    await page.click('[data-sb-check]');
    await check('building it in order is right', count('.sb .fb.right'));
    await page.click('#tNext');
    await check('and the next sentence comes up', count('.sb-bank .sb-tile', 4));
    await page.click('#quiz [data-close]');

    await page.click('#pMode [data-v=fc-en]');
    await page.evaluate(() => scrollTo(0, 1e5));
    await page.click('#pCount [data-v="10"]');
    await page.click('#pStart');
    for (let i = 0; i < 10; i++) {
      await page.click('#flip .prompt');
      await page.waitForTimeout(200);
      await page.click(`#fcAns [data-a="${i % 2}"]`);
    }
    await check('a round of 10 flashcards', async (p) => (await p.textContent('.result .score')).trim() === '5/10');
    await page.click('#rDone');

    await page.click('[data-tab=saved]');
    await check('tricky phrases are listed', async (p) => (await p.textContent('#savedBody')).includes('Tricky ones (5)'));
    await page.click('#logo');
    await check('logo goes home', async (p) => (await p.evaluate(() => location.hash)) === '#search');
  });
}

// ---------- the courses (src/course.js, tools/course.mjs) ----------
for (const lang of languages) {
  if (!lang.courses || (only.length && !only.includes(lang.code))) continue;
  const root = `${origin}/${lang.code}/courses/`;

  await run(`${lang.courses.title} (${lang.code}/courses)`, async (page, check) => {
    await page.goto(root);
    await check('the courses page lists a course', count('.card-list .card-link'));
    await check('no course content is mixed in at this level', async (p) =>
      (await p.locator('.pattern, .ex').count()) === 0);

    await page.locator('.card-list .card-link').first().click();
    await page.waitForLoadState();
    await check('the course page shows its levels', async (p) => (await p.locator('#cIntro .card-list .card-link').count()) === 2);
    await check('progress starts empty', async (p) => (await p.textContent('.prog .pct')).includes('0 of 35'));
    await check('what A1 builds up to is a prompt, not a checklist', async (p) =>
      (await p.locator('[data-check]').count()) === 0 && (await p.textContent('#cIntro')).includes('builds up to'));

    await page.fill('#cSearch', 'gustar');
    await page.waitForSelector('#cResults .hit', { timeout: 5000 });
    await check('searching the course finds a section', async (p) =>
      (await p.textContent('#cResults')).toLowerCase().includes('gustar'));
    await page.click('#cClear');
    await check('clearing the search brings the levels back', visible('#cIntro'));

    await page.click('#cIntro .card-list .card-link');
    await page.waitForLoadState();
    await check('the level page lists its sections', count('.card-list .card-link', 10));
    const all = await page.locator('.card-list .card-link').count();
    await page.click('#cFilter [data-f="core"]');
    const core = await page.locator('.card-list .card-link:not([hidden])').count();
    await check('filtering to core shows fewer sections', () => core > 0 && core < all);
    await page.click('#cFilter [data-f="all"]');

    await page.locator('.card-list .card-link').first().click();
    await page.waitForLoadState();
    const section = page.url();
    await check('the section opens on Learn, one pane at a time', async (p) =>
      (await p.locator('[data-pane="learn"]').isVisible()) && !(await p.locator('[data-pane="ref"]').isVisible()));
    await check('Learn holds the patterns', count('[data-pane="learn"] .pattern'));
    await page.click('.tab-bar label[for="pane-ex"]');
    await check('Examples is its own pane, with pronunciations', async (p) =>
      (await p.locator('[data-pane="ex"]').isVisible()) && (await p.locator('[data-pane="ex"] .ph').count()) > 0);
    await page.click('.tab-bar label[for="pane-do"]');
    await check('Practise holds the launchers and the can-you list', async (p) =>
      (await p.locator('[data-pane="do"] [data-practice]').count()) > 0 && (await p.locator('.can li').count()) > 0);

    // progress is earned: practising marks the section, one tap marks it refreshed
    await check('nothing is claimed before you do anything', async (p) =>
      (await p.textContent('#markNote')).includes('Practise it first'));
    await page.click('#markDone');
    await check('marking it refreshed shows on the page', async (p) =>
      (await p.getAttribute('#markDone', 'aria-pressed')) === 'true' && (await p.textContent('.pill')).includes('Refreshed'));
    await page.click('#markDone');
    await check('and it can be undone', async (p) => (await p.getAttribute('#markDone', 'aria-pressed')) === 'false');

    await page.click('[data-practice="build"]');
    await check('the builder opens with a word bank', count('.sb-bank .sb-tile', 4));
    const want = await page.evaluate(() => {
      const en = document.querySelector('.sb-prompt').textContent;
      return JSON.parse(document.getElementById('page').textContent).build.find((b) => b.en === en).es.split(/\s+/);
    });
    await page.evaluate(() => {
      [...document.querySelectorAll('.sb-bank .sb-tile')].find((b) => !b.classList.contains('gone')).click();
    });
    await check('tapping a tile moves it into the sentence', count('.sb-line .sb-tile', 1));
    await page.click('.sb-line .sb-tile');
    await check('tapping it again sends it back', async (p) => (await p.locator('.sb-line .sb-tile').count()) === 0);
    for (const word of want) {
      await page.evaluate((w) => {
        [...document.querySelectorAll('.sb-bank .sb-tile')].find((x) => !x.classList.contains('gone') && x.textContent === w).click();
      }, word);
    }
    // the ruled lines are drawn by a repeating gradient, so the row pitch and the period
    // have to stay in step or later rows sit on (or through) their rule
    await check('every word clears the rule under it', async (p) => {
      const gaps = await p.evaluate(() => {
        const line = document.querySelector('.sb-line');
        const top = line.getBoundingClientRect().top;
        return [...line.querySelectorAll('.sb-tile')].map((t) => {
          const bottom = t.getBoundingClientRect().bottom - top;
          return Math.round(Math.ceil((bottom - 49) / 57) * 57 + 49 - bottom);
        });
      });
      return gaps.length > 0 && gaps.every((g) => g === 5);
    });
    await page.click('[data-sb-check]');
    await check('the right order is marked right', count('.sb .fb.right'));
    await page.click('#pNext');
    await check('and it moves on to the next sentence', count('.sb-bank .sb-tile', 4));
    await page.click('#practice [data-close]');
    await page.reload();
    await check('finishing a round counts as practised', async (p) =>
      (await p.textContent('.pill')).includes('Practised') && (await p.textContent('#markNote')).includes('Practised'));

    await page.goto(section);
    await page.click('.tabs a:first-child');
    await page.waitForLoadState();
    await check('the Home tab goes back to the app', async (p) =>
      new URL(p.url()).pathname === `/${lang.code}/` && (await p.locator('#v-search').count()) === 1);
    await check('the app offers the courses below the everyday choices', async (p) =>
      (await p.getAttribute('.choices a[href="courses/"]', 'href')) === 'courses/');
    await check('and keeps them out of the main choice list', async (p) =>
      (await p.locator('.choices').first().locator('a[href="courses/"]').count()) === 0);
  });
}

// ---------- wide screens ----------
// The overlays centre a 640px column; the progress bar has to sit over it, not off to
// the left (it needs an explicit width, or the flex parent stretches it instead).
{
  const context = await browser.newContext({ viewport: { width: 1600, height: 800 } });
  const page = await context.newPage();
  const lang = languages.find((l) => l.courses) || languages[0];
  console.log('wide screen (1600px)');
  const check = async (label, test) => {
    try {
      if ((await test(page)) === false) throw new Error('returned false');
      console.log(`  ok   ${label}`);
    } catch (e) {
      failures++;
      console.log(`  FAIL ${label}: ${e.message.split('\n')[0]}`);
    }
  };
  // how far the bar's middle is from the middle of the window
  const offset = async (p) => p.evaluate(() => {
    const r = document.querySelector('.overlay:not([hidden]) .progress').getBoundingClientRect();
    return Math.abs(r.left + r.width / 2 - innerWidth / 2);
  });

  await page.goto(pageUrl(lang.code));
  await page.click('#welcomeOk');
  await page.click('[data-tab=practice]');
  await page.click('#pMode [data-v=build]');
  await page.click('#pStart');
  await check('the app quiz centres its progress bar', async (p) => (await offset(p)) <= 1);
  await page.click('#quiz [data-close]');

  if (lang.courses) {
    await page.goto(`${origin}/${lang.code}/courses/a1/a1-1/greetings-farewells/`);
    await page.click('.tab-bar label[for="pane-do"]');
    await page.click('[data-practice="build"]');
    await check('the course practice centres its progress bar', async (p) => (await offset(p)) <= 1);
  }
  await context.close();
}

await browser.close();
server.close();
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll browser checks passed');
