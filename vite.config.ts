import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { MANIFEST } from './manifest.ts'

/**
 * The two doors that are not the page, served by Vite alongside it.
 *
 * A module is one origin or it is nothing: the protocol refuses a manifest
 * whose `entry` points anywhere but the origin the manifest itself came from,
 * and it is right to — a program that could name somebody else's page would be
 * a program that could have the host frame somebody else. So the manifest, the
 * page and the health check cannot be split across two ports for the
 * convenience of whoever is editing them.
 *
 * Which is why these are middleware here rather than a second server. Vite
 * serves the page with no build step and no artifact in the tree, and answers
 * the other two paths on the same origin, so the arrangement a host sees is the
 * arrangement that exists.
 */
function doors(): Plugin {
  return {
    name: 'atlas-doors',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0]
        if (path === '/.well-known/roadmap-module.json') {
          response.setHeader('content-type', 'application/json; charset=utf-8')
          response.end(JSON.stringify(MANIFEST, null, 2))
          return
        }
        if (path === '/healthz') {
          response.setHeader('content-type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ ok: true, id: MANIFEST.id }))
          return
        }
        /*
         * The page's own door, and it has to be a door rather than a default.
         *
         * `entry` is `/app`, and under Vite dev that path is not free: the root
         * is `page/`, `page/app.tsx` exists, and Vite's transform middleware
         * resolves an extensionless request to the module that matches it. So
         * `GET /app` answered `200 text/javascript` with the compiled source of
         * `app.tsx` — a document a browser loads happily and runs nothing in.
         * The frame's `load` event fired, the host greeted it, and there was no
         * script in there to hear the greeting: "loaded its page and did not
         * answer", which was true and named the wrong half of the problem.
         *
         * The old off-disk server routed `/app` to `index.html` explicitly.
         * Moving to Vite dev dropped that route and nothing replaced it, which
         * is how a path collision with a source file became silence on the
         * wire. The rewrite puts it back: `/app` is the page, by name, and no
         * longer depends on which files happen to sit next to it.
         */
        if (path === '/app' || path === '/app/') {
          request.url = '/index.html'
          next()
          return
        }
        next()
      })
    },
  }
}

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * The build.
 *
 * `root` is `page/`, so the page's own `index.html` is the entry and nothing in
 * the app's root — the server, the manifest, the tests — is ever pulled into a
 * browser bundle by accident.
 *
 * `base: '/'` and absolute asset URLs, because the page is served at `/app`
 * while its assets live under `/assets/`. A relative base would make the asset
 * URLs depend on whether the host framed `/app` or `/app/`, which is a
 * difference nobody should have to think about and which fails only in the
 * embedded case, where it is hardest to notice.
 */
export default defineConfig({
  root: here('./page'),
  base: '/',
  plugins: [doors(), react(), tailwindcss()],
  server: {
    /**
     * A module framed by the host is on an OPAQUE ORIGIN, and that makes this
     * page's own scripts cross-origin to itself.
     *
     * The host sandboxes a module without `allow-same-origin` unless its
     * manifest declares storage, and this one does not. So the document has no
     * origin of its own: every request it makes carries `Origin: null`. That is
     * fine for the page itself, which the browser navigates to — and fatal for
     * the scripts inside it, because `<script type="module">` is ALWAYS fetched
     * in CORS mode. There is no same-origin shortcut for a module script, and
     * an opaque origin matches nothing, so without a header saying otherwise
     * the browser refuses every one of them.
     *
     * What that looks like is the thing worth remembering. The document loads.
     * The `load` event fires. The host greets it. And nothing answers, because
     * no script in that document ever ran — `main.tsx`, `@vite/client` and
     * `@react-refresh` were all blocked, silently as far as the host is
     * concerned. The pane says the page "is not speaking", which is true and
     * says nothing about why. `curl` cannot see it either: curl is not subject
     * to CORS, so every door answered 200 with exactly the right bytes.
     *
     * This is not a development-only concern. A built page uses module scripts
     * too, so whatever serves this app in any arrangement has to answer with
     * the same permission. It costs nothing to give: this origin serves a
     * public page, a manifest and a health check, holds no credential, and has
     * no write path for a header to protect.
     */
    cors: true,
  },
  resolve: {
    alias: {
      '@': here('./page'),
      /*
       * `roadmap-module-protocol` used to be aliased here, to its source in the
       * repository this app used to live in. Both halves of that are gone: the
       * protocol is its own repository now, and it is resolved by name like any
       * other dependency. See PACKAGING.md there for why it had to be reached
       * past in the first place, and why it no longer does.
       */
    },
  },
  build: {
    outDir: here('./dist'),
    emptyOutDir: true,
  },
})
