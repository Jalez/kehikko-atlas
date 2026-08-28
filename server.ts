#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WELL_KNOWN } from 'roadmap-module-protocol'
import { ID, MANIFEST, VERSION } from './manifest.ts'

/**
 * Atlas, as a program of its own.
 *
 *   ./run.sh                    # or: PORT=7830 bun run server.ts
 *
 * One server with three doors and no store behind any of them:
 *
 *  - `/.well-known/roadmap-module.json`, the only path a host ever asks for and
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

/** The manifest, serialised once. It cannot change while the process is alive. */
const MANIFEST_JSON = JSON.stringify(MANIFEST, null, 2)

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

/** The page. Never cached, because a rebuilt bundle must not be shadowed by a stale document. */
function page(): Response {
  const index = join(BUILT, 'index.html')
  if (!existsSync(index)) {
    /**
     * A plain sentence rather than a stack trace, because the person who sees
     * this is the person who cloned the repository and ran the server before
     * building the page. Telling them the one command is worth more than any
     * amount of detail about what was missing.
     */
    return new Response(
      'Atlas has no built page. Run `bun install && bun run build` in this directory, then start it again.\n',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  }
  return new Response(Bun.file(index), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

const server = Bun.serve({
  port: PORT,
  fetch(request) {
    const { pathname } = new URL(request.url)

    /**
     * The manifest. `no-store` because a host asks for this to find out whether
     * the program on this port is still the program it thinks it is, and an
     * answer out of a cache would let a module that has been replaced keep
     * describing itself as the old one.
     */
    if (pathname === WELL_KNOWN) {
      return new Response(MANIFEST_JSON, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    }

    /**
     * Liveness, and nothing more. It says this process is answering. It
     * deliberately does not say anything about whether a host is talking to the
     * page, because that is not a fact this process has — the conversation
     * happens in a browser, in a frame, and a server that claimed to know how it
     * was going would be guessing.
     */
    if (pathname === '/healthz') {
      return Response.json({ ok: true, id: ID, version: VERSION })
    }

    if (pathname === '/app' || pathname === '/app/' || pathname === '/') return page()

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
