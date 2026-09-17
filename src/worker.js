// Serves every LingoBrix site from one Worker, choosing the folder in dist/ by hostname:
//
//   lingobrix.com            → dist/index.html (home page)
//   www.lingobrix.com        → redirects to lingobrix.com
//   <language>.lingobrix.com → dist/<code>/index.html (see languages.mjs)
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;

    if (host === `www.${APEX}`) {
      return Response.redirect(`https://${APEX}${url.pathname}${url.search}`, 301);
    }

    let folder;
    if (host === APEX) {
      // an old-style link like lingobrix.com/es/ goes to the language's own domain
      const code = url.pathname.split('/')[1];
      const langHost = Object.keys(SITES).find((h) => SITES[h] === code);
      if (langHost) return Response.redirect(`https://${langHost}/`, 301);
      folder = '/';
    } else if (SITES[host]) {
      folder = `/${SITES[host]}/`;
    } else {
      return withHeaders(await env.ASSETS.fetch(request));
    }

    // each site is a single page: files (robots.txt etc.) don't exist, other paths go home
    if (url.pathname !== '/' && url.pathname !== '/index.html') {
      if (url.pathname.includes('.')) return new Response('Not found', { status: 404 });
      return Response.redirect(`https://${host}/`, 302);
    }
    return withHeaders(await env.ASSETS.fetch(new Request(new URL(folder, url), request)));
  },
};

function withHeaders(response) {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
  return res;
}
