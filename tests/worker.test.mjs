// Checks src/worker.js picks the right site, and the right file, for each URL (run: npm test).
// Uses a fake ASSETS binding holding the paths dist/ really has, so a missing page 404s
// or goes home just as it would in production.
import worker from '../src/worker.js';

const FILES = new Set([
  '/',
  '/sites.json',
  '/es/',
  '/de/',
  '/fr/',
  '/pt/',
  '/es/courses/',
  '/es/courses/a1/',
  '/es/courses/a1/a1-1/',
  '/es/courses/a1/a1-1/greetings-farewells/',
  '/es/courses/a1/data/a1-1.json',
  '/es/courses/assets/course.abcdef12.js', // any 8-hex hash: the name only has to match the immutable-cache rule
]);

const env = {
  ASSETS: {
    fetch: async (req) => {
      const { pathname } = new URL(req.url ?? req);
      if (FILES.has(pathname)) return new Response(`asset ${pathname}`);
      // the real assets service adds the trailing slash a directory needs
      if (FILES.has(`${pathname}/`)) return new Response(null, { status: 301, headers: { location: `${pathname}/` } });
      return new Response('not found', { status: 404 });
    },
  },
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
  ['https://portuguese.lingobrix.com/', 200, 'asset /pt/'],
  ['https://lingobrix.com/pt/', 301, 'https://portuguese.lingobrix.com/'],
  ['https://german.lingobrix.com/anything', 302, 'https://german.lingobrix.com/'],
  ['https://spanish.lingobrix.com/robots.txt', 404, 'Not found'],
  ['https://lingobrix.com/sites.json', 404, 'Not found'],
  ['http://localhost:8787/de/', 200, 'asset /de/'],
  // the courses: real pages under the language host
  ['https://spanish.lingobrix.com/courses/', 200, 'asset /es/courses/'],
  ['https://spanish.lingobrix.com/courses/a1/', 200, 'asset /es/courses/a1/'],
  ['https://spanish.lingobrix.com/courses/a1/a1-1/', 200, 'asset /es/courses/a1/a1-1/'],
  ['https://spanish.lingobrix.com/courses/a1/a1-1/greetings-farewells/', 200, 'asset /es/courses/a1/a1-1/greetings-farewells/'],
  ['https://spanish.lingobrix.com/courses/a1/data/a1-1.json', 200, 'asset /es/courses/a1/data/a1-1.json'],
  ['https://spanish.lingobrix.com/courses/assets/course.abcdef12.js', 200, 'asset /es/courses/assets/course.abcdef12.js'],
  // a missing slash is fixed without the dist/ folder showing up in the address bar
  ['https://spanish.lingobrix.com/courses/a1/a1-1', 301, 'https://spanish.lingobrix.com/courses/a1/a1-1/'],
  // a course page that doesn't exist goes home; a missing file is a 404
  ['https://spanish.lingobrix.com/courses/a1/a1-1/nope/', 302, 'https://spanish.lingobrix.com/'],
  ['https://spanish.lingobrix.com/courses/a1/data/a9-9.json', 404, 'Not found'],
  // the other languages have no courses
  ['https://german.lingobrix.com/courses/', 302, 'https://german.lingobrix.com/'],
];

let failed = 0;
for (const [url, status, expected] of cases) {
  const res = await worker.fetch(new Request(url), env);
  const got = res.status >= 300 && res.status < 400 ? res.headers.get('location') : await res.text();
  const ok = res.status === status && got === expected && (res.status >= 300 || res.headers.get('cache-control'));
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${url} → ${res.status} ${got}${ok ? '' : `   (expected ${status} ${expected})`}`);
}

// the hashed CSS and JS can be cached for ever; pages can't
const asset = await worker.fetch(new Request('https://spanish.lingobrix.com/courses/assets/course.abcdef12.js'), env);
const page = await worker.fetch(new Request('https://spanish.lingobrix.com/courses/'), env);
for (const [label, res, want] of [['hashed asset', asset, 'immutable'], ['courses page', page, 'max-age=3600']]) {
  const ok = (res.headers.get('cache-control') || '').includes(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} cache-control ${res.headers.get('cache-control')}`);
}

if (failed) {
  console.error(`\n${failed} worker check(s) failed`);
  process.exit(1);
}
