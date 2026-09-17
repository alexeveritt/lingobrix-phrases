// Browser smoke test for the built sites in dist/ (run: npm test).
//
// Opens each page in your installed Google Chrome, emulating an iPhone, and clicks through
// the main features. Uses playwright-core, so no browsers are downloaded.
//
//   npm test                 all sites
//   node tests/smoke.mjs de  just German (after npm run build)
import { chromium, devices } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import languages from '../languages.mjs';

const only = process.argv.slice(2);
const SEARCH = { es: 'móvil', de: 'Handy', fr: 'portable' };
const pageUrl = (path) => pathToFileURL(resolve('dist', path, 'index.html')).href;

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

    await page.fill('#q', SEARCH[lang.code]);
    await check(`search "${SEARCH[lang.code]}" finds phrases`, count('#results .row', 3));
    await page.locator('#results .row').first().click();
    await check('card opens', visible('#viewer'));
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

    await page.click('[data-tab=topics]');
    await check('topic tiles', count('.tile', 10));
    await page.locator('.tile').nth(2).click();
    await check('kid tab uses the picked icon', async (p) => (await p.textContent('[data-side="t"]')).includes('⚽ Kid says'));
    await page.click('[data-side="t"]');
    await page.click('#tTest');
    await check('Test me keeps the kid tab', async (p) => (await p.inputValue('#pTopic')).endsWith(':t'));

    await page.click('#pMode [data-v=type]');
    await page.click('#pStart');
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

await browser.close();
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll browser checks passed');
