#!/usr/bin/env bun
import { run } from 'kehikot-module-protocol/run'

import { BUILD, MANIFEST, answer } from './doors.ts'
import { ID, PREFERRED_PORT } from './manifest.ts'

/**
 * Atlas over its BUILT page (`bun run build`), on the same doors and the same
 * port as the dev server. `run.sh` starts this when `dist/` carries a stamp of
 * the commit checked out, and Vite otherwise.
 *
 *   bun run build && bun run start     # or: PORT=7830 bun run serve.ts
 *
 * Nothing Atlas says is decided here: the manifest, `/app` and `/healthz` are
 * the protocol's doors over `answer` in `doors.ts`, mounted by the protocol's
 * `run` exactly as `doors()` mounts them on Vite. There is still no API, no
 * write path and no ticket. The page is `dist/index.html` with this process's
 * build and frame origins printed in per request.
 *
 * ## The two things a page on an opaque origin needs
 *
 * Atlas declares no storage, so a host frames it WITHOUT `allow-same-origin`
 * and its page is on an opaque origin: every request it makes says
 * `Origin: null`. A module script is always fetched in CORS mode, so without a
 * header saying it may, not one script of the page runs — the frame loads, the
 * host greets it, and nothing answers. `cors: true` is that header on the files
 * of `dist/` (for `null` and the frame origins only), what `server.cors` is in
 * `vite.config.ts`. `openHealth` lets the page read `/healthz` from there, as
 * on Vite. Every other door keeps the protocol's gate.
 *
 * `run` also refuses a request whose `Host` is not this machine's name, before
 * any door, as Vite does: the gate reads `Origin` against `Host`, so a name
 * somebody pointed at 127.0.0.1 is not this program. That fence used to be
 * this module's own (`answersAt`); it is the protocol's now.
 *
 * A build that is not this checkout's is never served: `run` answers the page
 * with a 503 saying which commit each is, and the command to run.
 */
await run({
  id: ID,
  prefer: PREFERRED_PORT,
  dir: import.meta.dirname,
  manifest: MANIFEST,
  answer,
  build: BUILD,
  openHealth: true,
  cors: true,
})
