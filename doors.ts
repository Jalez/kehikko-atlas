import { establishBuild, type PageOptions, type Reply } from 'kehikot-module-protocol/serve'
import { ID, MANIFEST, VERSION } from './manifest.ts'

/**
 * What this app answers that is not the page, and what its page is — said once,
 * for both of the servers that can be in front of it: Vite, through the
 * protocol's `doors()` in `vite.config.ts`, and the built page's `Bun.serve`,
 * through `doorsFetch` in `server.ts`. No socket is held here.
 *
 * ## No ticket
 *
 * A ticket fences writes. This app has no write path, no credential, no state
 * and no query parameter that reaches anything, so its page is printed without
 * one.
 */

/**
 * What this process is built from, established once so it is one identity for
 * the life of the process. The doors say it in the manifest, in the health
 * check's answer, in the page, and as a stamp on every answer.
 */
export const BUILD = establishBuild({ version: VERSION, dir: import.meta.dirname })

/**
 * The page document, which the protocol generates: themed before any script of
 * this app's has run, with this process's build printed into it.
 *
 * `entry` is `/main.tsx` because Vite's root is `page/`, so nothing in the
 * app's root — the server, the manifest, the tests — is ever pulled into a
 * browser bundle by accident.
 */
export const PAGE: PageOptions = {
  title: 'Atlas — projects and their epics',
  entry: '/main.tsx',
  head: '<meta name="description" content="A map of the territory: which projects exist, and which epics are in each of them.">',
}

/**
 * Liveness, and nothing more. It says this process is answering. It
 * deliberately does not say anything about whether a host is talking to the
 * page, because that is not a fact this process has — the conversation happens
 * in a browser, in a frame, and a server that claimed to know how it was going
 * would be guessing.
 *
 * ## Why this one answer is readable from anywhere
 *
 * A host frames this module WITHOUT `allow-same-origin` (its manifest declares
 * no storage), so the page is on an opaque origin and its own server is
 * cross-origin to it. When the page asks whether that server is still there,
 * the browser lets it read the answer only if the answer says so. It costs
 * nothing to say: this is a public fact about a process that holds no
 * credential, and the same one `curl` reads. Both servers say it by passing
 * `openHealth` to the protocol's doors, which opens this door and no other.
 */
export function answer(method: string, path: string): Reply | null {
  if (path !== '/healthz') return null
  if (method !== 'GET' && method !== 'HEAD') return { status: 405, body: { ok: false, error: 'this door only answers GET' } }
  return { status: 200, body: { ok: true, id: ID, version: VERSION } }
}

export { MANIFEST }
