// Serves every LingoBrix site from one Worker, choosing the folder in dist/ by hostname:
//
//   lingobrix.com            → dist/index.html (home page)
//   www.lingobrix.com        → redirects to lingobrix.com
//   <language>.lingobrix.com → dist/<code>/… (see languages.mjs)
//
// The language apps are a single page, but the course under /course/ is many pages, so a
// language host serves anything that exists in its folder and sends the rest home.
//
// Any other host (localhost, *.workers.dev) serves dist/ as it is, so /es/, /de/ and /fr/
// can be tried locally with `npm run dev`.
import SITES from '../dist/sites.json' with { type: 'json' };

const APEX = 'lingobrix.com';
const HEADERS = {
  // browsers keep the page for an hour, then refresh it in the background
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=604800',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
// course.<hash>.css and .js are named after their contents, so they never change
const FOREVER = 'public, max-age=31536000, immutable';
const hashed = (path) => /\/assets\/[\w.-]+\.[0-9a-f]{8}\.(css|js)$/.test(path);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;

    if (host === `www.${APEX}`) {
      return Response.redirect(`https://${APEX}${url.pathname}${url.search}`, 301);
    }

    if (host === APEX) {
      // an old-style link like lingobrix.com/es/ goes to the language's own domain
      const code = url.pathname.split('/')[1];
      const langHost = Object.keys(SITES).find((h) => SITES[h] === code);
      if (langHost) return Response.redirect(`https://${langHost}/`, 301);
      // the home page is one page: nothing else on the apex is public
      if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Not found', { status: 404 });
      return withHeaders(await env.ASSETS.fetch(new Request(new URL('/', url), request)));
    }

    const folder = SITES[host] ? `/${SITES[host]}` : null;
    if (!folder) return withHeaders(await env.ASSETS.fetch(request));

    const path = url.pathname === '/index.html' ? '/' : url.pathname;
    const target = new URL(folder + path + url.search, url);
    const res = await env.ASSETS.fetch(new Request(target, request));

    if (res.status === 404) {
      // a missing file is a 404; a missing page (/anything) goes back to the home screen
      if (path.split('/').pop().includes('.')) return new Response('Not found', { status: 404 });
      return Response.redirect(`https://${host}/`, 302);
    }
    // the assets service redirects /course/a1-1 to /course/a1-1/; keep the folder out of it
    if (res.status >= 300 && res.status < 400) {
      const to = new URL(res.headers.get('location') || '/', target);
      const stripped = to.pathname.startsWith(`${folder}/`) ? to.pathname.slice(folder.length) : to.pathname;
      return Response.redirect(`https://${host}${stripped}${to.search}`, res.status === 308 ? 308 : 301);
    }
    return withHeaders(res, hashed(path) ? FOREVER : null);
  },
};

function withHeaders(response, cache) {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
  if (cache) res.headers.set('Cache-Control', cache);
  return res;
}
