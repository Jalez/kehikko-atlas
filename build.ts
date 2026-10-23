#!/usr/bin/env bun
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanTree, clearStamp, writeStamp } from 'kehikot-module-protocol/build'
import { commitOf, pageDocument } from 'kehikot-module-protocol/serve'
import { build } from 'vite'

import { PAGE } from './doors.ts'

/**
 * Compile the page to static assets for `serve.ts`, and stamp them with the
 * commit.
 *
 *   bun run build            # then: bun run start
 *
 * Vite's build starts from an HTML file on disk. This app keeps none: the
 * document is the protocol's `pageDocument`, the same one the dev server
 * generates, so the built page and the dev page cannot drift apart. So the
 * entry is written where Vite's root expects it — `page/`, not this folder,
 * which is why this is not the protocol's `buildModule` (that writes the entry
 * beside `vite.config.ts` and builds from there) — built, and taken away again.
 * It is written without a build identity: that belongs to the process that
 * serves it, and `run` prints it in per request.
 *
 * The stamp is the protocol's (`dist/.kehikot-built`, the commit on its first
 * line), kept by the protocol's rule: taken off before the build, written only
 * after one that succeeded, from a checkout whose tracked files match `HEAD`. A
 * build of an edited checkout is built and NOT stamped, and `run.sh` keeps Vite
 * for it.
 *
 * `finally` removes the entry, and it is gitignored as a second line of
 * defence: a leftover `page/index.html` would be a second answer to what the
 * page says.
 */
const ROOT = import.meta.dirname
const ENTRY = join(ROOT, 'page', 'index.html')
const DIST = join(ROOT, 'dist')

mkdirSync(DIST, { recursive: true })
clearStamp(DIST)
const before = { commit: commitOf(ROOT), clean: cleanTree(ROOT) }

writeFileSync(ENTRY, pageDocument(PAGE), 'utf8')
try {
  await build({ mode: 'production' })
} finally {
  rmSync(ENTRY, { force: true })
}

const commit = commitOf(ROOT)
if (!commit) {
  console.log(`${ROOT} is not a git checkout, so the build was not stamped and \`bun run start\` will not serve it.`)
  process.exitCode = 2
} else if (before.clean !== true || cleanTree(ROOT) !== true || before.commit !== commit) {
  console.log(`${ROOT} has changes to tracked files, so the build is not ${commit.slice(0, 7)} and was not stamped; \`bun run start\` will not serve it.`)
  process.exitCode = 2
} else {
  console.log(`built ${commit.slice(0, 7)} into ${DIST} (stamp: ${writeStamp(DIST, commit)})`)
}
