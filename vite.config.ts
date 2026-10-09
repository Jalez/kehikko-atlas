import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { doors } from 'kehikot-module-protocol/serve'
import { BUILD, MANIFEST, PAGE, answer } from './doors.ts'

/**
 * The doors that are not Vite's own are the protocol's `doors()`, served by
 * Vite alongside the page: the manifest at both well-known paths, the page
 * (generated, `no-store`, `frame-ancestors`) and the health check through
 * `answer` in `doors.ts`. See the protocol's docs/module-plumbing.md.
 *
 * A module is one origin or it is nothing: the protocol refuses a manifest
 * whose `entry` points anywhere but the origin the manifest itself came from,
 * and it is right to — a program that could name somebody else's page would be
 * a program that could have the host frame somebody else. So the manifest, the
 * page and the health check cannot be split across two ports for the
 * convenience of whoever is editing them.
 *
 * ## `/app` has to be a door rather than a default
 *
 * `entry` is `/app`, and under Vite dev that path is not free: the root is
 * `page/`, `page/app.tsx` exists, and Vite's transform middleware resolves an
 * extensionless request to the module that matches it. So `GET /app` once
 * answered `200 text/javascript` with the compiled source of `app.tsx` — a
 * document a browser loads happily and runs nothing in. The frame's `load`
 * event fired, the host greeted it, and there was no script in there to hear
 * the greeting. `doors()` claims the path before Vite's resolver sees it, which
 * is why it is ahead of the framework's plugins below.
 */

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * The build.
 *
 * `root` is `page/`, so nothing in the app's root — the server, the manifest,
 * the tests — is ever pulled into a browser bundle by accident. There is no
 * `index.html` there: the document is generated (`PAGE` in `doors.ts`), and
 * `build.ts` writes it out for the length of a build.
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
  plugins: [doors({ manifest: MANIFEST, answer, build: BUILD, page: PAGE }), react(), tailwindcss()],
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
       * `kehikot-module-protocol` used to be aliased here, to its source in the
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
