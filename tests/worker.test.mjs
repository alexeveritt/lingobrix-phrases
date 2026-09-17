// Checks src/worker.js picks the right site for each hostname (run: npm test).
// Uses a fake ASSETS binding that just reports which path was asked for.
import worker from '../src/worker.js';

const env = {
  ASSETS: { fetch: async (req) => new Response(`asset ${new URL(req.url ?? req).pathname}`) },
};

const cases = [
  // [url, status, body or redirect target]
  ['https://lingobrix.com/', 200, 'asset /'],
  ['https://lingobrix.com/index.html', 200, 'asset /'],
  ['https://www.lingobrix.com/', 301, 'https://lingobrix.com/'],
  ['https://www.lingobrix.com/?x=1', 301, 'https://lingobrix.com/?x=1'],
  ['https://lingobrix.com/es/', 301, 'https://spanish.lingobrix.com/'],
  ['https://lingobrix.com/fr', 301, 'https://french.lingobrix.com/'],
  ['https://spanish.lingobrix.com/', 200, 'asset /es/'],
  ['https://german.lingobrix.com/', 200, 'asset /de/'],
  ['https://french.lingobrix.com/', 200, 'asset /fr/'],
  ['https://german.lingobrix.com/anything', 302, 'https://german.lingobrix.com/'],
  ['https://spanish.lingobrix.com/robots.txt', 404, 'Not found'],
  ['https://lingobrix.com/sites.json', 404, 'Not found'],
  ['http://localhost:8787/de/', 200, 'asset /de/'],
];

let failed = 0;
for (const [url, status, expected] of cases) {
  const res = await worker.fetch(new Request(url), env);
  const got = res.status >= 300 && res.status < 400 ? res.headers.get('location') : await res.text();
  const ok = res.status === status && got === expected && (res.status >= 300 || res.headers.get('cache-control'));
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${url} → ${res.status} ${got}${ok ? '' : `   (expected ${status} ${expected})`}`);
}
if (failed) {
  console.error(`\n${failed} worker check(s) failed`);
  process.exit(1);
}
