#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WELL_KNOWN } from 'kehikot-module-protocol'
import { PAGE_PATHS, doorsFetch, fillPage } from 'kehikot-module-protocol/serve'
import { BUILD, MANIFEST, answer } from './doors.ts'
import { VERSION } from './manifest.ts'

/**
 * Atlas, as a program of its own.
 *
 *   ./run.sh                    # or: PORT=7830 bun run server.ts
 *
 * One server with three doors and no store behind any of them:
 *
 *  - `/.well-known/kehikot-module.json` (and the pre-rename `roadmap-module.json`,
 *    the same manifest spelled for an older host), the only path a host ever asks for and
 *    the whole reason a host can find this at all;
 *  - `/app`, a page fit to be framed and equally fit to be opened directly;
 *  - `/healthz`, so that "not running" and "broken" can be different words on
 *    somebody's panel.
 *
 * ## Why it is this boring
 *
 * There is no API here. Not a thin one, not one for the page's convenience —
 * none. Every piece of material this app draws comes from a host across the
 * frame, so a route on this server that returned projects or epics would be a
 * second source of the same answer, and a page that could get its data two ways
 * is a page that will eventually show one while claiming the other. The server
 * ships a document and a static bundle. That is the whole job, and keeping it
 * the whole job is what makes the honest-absence screens in `atlas/situation.ts`
 * true rather than aspirational: when there is no host, there is genuinely
 * nothing this program could draw.
 *
 * It also means there is nothing here to defend. No write path, no credential,
 * no state, no query parameter that reaches anything. The only bytes it serves
 * are ones that were on disk when it started.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const BUILT = join(HERE, 'dist')

/**
 * The port is whoever started this program's decision.
 *
 * A module that picked its own would answer somewhere nobody is looking: a host
 * that starts a module hands it a port and then goes to that port. The default
 * is for running it by hand and matches the one in `run.sh`, so both ways of
 * starting it land in the same place.
 */
const PORT = Number(process.env.PORT ?? 7830)

/**
 * Serve one file out of the build, or nothing.
 *
 * `normalize` and the prefix check together are what stop `/assets/../../etc/x`
 * from leaving the build directory. It is a small surface — only `/assets/`
 * reaches this — but "small surface" has never been a reason a path traversal
 * did not work, and the check is two lines.
 */
function asset(pathname: string): Response | null {
  const wanted = normalize(join(BUILT, pathname))
  if (!wanted.startsWith(BUILT)) return null
  if (!existsSync(wanted)) return null
  return new Response(Bun.file(wanted), {
    headers: {
      /**
       * Vite fingerprints every asset filename with a content hash, so a file
       * under `/assets/` can never change meaning. Immutable is exactly true of
       * it, and the page itself below is exactly the opposite.
       */
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

const INDEX = join(BUILT, 'index.html')

/**
 * The manifest, the page and the health check: the protocol's doors, the same
 * ones Vite serves in development (`vite.config.ts`), as one function from a
 * `Request` to a `Response`.
 *
 * The page was built ahead of this process, so it carries no build identity of
 * its own; `fillPage` prints this process's into it. Read from disk on every
 * request rather than once at start, so a rebuild while this is running is
 * picked up by the next reload. Never cached, because a rebuilt bundle must not
 * be shadowed by a stale document; framed by a host and by nothing else.
 */
const through = doorsFetch({
  manifest: MANIFEST,
  answer,
  build: BUILD,
  page: () => fillPage(readFileSync(INDEX, 'utf8'), { build: BUILD }),
})

/**
 * A plain sentence rather than a stack trace, because the person who sees this
 * is the person who cloned the repository and ran the server before building
 * the page. Telling them the one command is worth more than any amount of
 * detail about what was missing.
 */
const unbuilt = () =>
  new Response('Atlas has no built page. Run `bun install && bun run build` in this directory, then start it again.\n', {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const { pathname } = new URL(request.url)

    if (PAGE_PATHS.includes(pathname) && !existsSync(INDEX)) return unbuilt()

    const ours = await through(request)
    if (ours) return ours

    if (pathname.startsWith('/assets/')) {
      const found = asset(pathname)
      if (found) return found
    }

    return new Response('Not found\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  },
})

console.log(`Atlas ${VERSION} on http://localhost:${server.port}`)
console.log(`  page      http://localhost:${server.port}/app`)
console.log(`  manifest  http://localhost:${server.port}${WELL_KNOWN}`)
