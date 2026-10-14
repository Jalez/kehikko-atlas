#!/usr/bin/env bun
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { originFor, preferred, registerAt } from 'kehikot-module-protocol/serve'

import { ID, PREFERRED_PORT } from './manifest.ts'

/**
 * Tell a host where Atlas answers, without starting it.
 *
 *   bun run register            # or: PORT=7831 bun run register
 *
 * It writes one file, `<id>.json`, in the directory a host sweeps for modules
 * (`KEHIKOT_MODULES_DIR` when set), naming an origin and the directory `run.sh`
 * is in. `registerAt` merges rather than overwrites, so anything somebody set
 * beside those two — `keep` above all — survives.
 *
 * Starting Atlas (`./run.sh`, or `bun run start` for the built page) writes the
 * same file with the port it actually bound, so this is for registering a
 * checkout that is not running yet.
 */
/* `PORT` when it names a port, as the start reads it; anything else is not one. */
const port = preferred(PREFERRED_PORT)
const written = registerAt({
  id: ID,
  origin: originFor(port),
  dir: dirname(fileURLToPath(import.meta.url)),
})

console.log(`registered: ${written.file} -> ${written.url} (${written.dir})`)
if (written.was) console.log(`  (was ${written.was.url} in ${written.was.dir})`)
console.log('Start the app with ./run.sh, then reload the host; it sweeps the directory on every read.')
console.log(`If ${port} is taken, ./run.sh moves to the next free port and rewrites this file to match.`)
