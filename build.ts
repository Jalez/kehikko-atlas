#!/usr/bin/env bun
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { pageDocument } from 'kehikot-module-protocol/serve'
import { build } from 'vite'

import { PAGE } from './doors.ts'

/**
 * Compile the page to static assets, for `server.ts`.
 *
 *   bun run build            # then: bun run start
 *
 * Vite's build starts from an HTML file on disk. This app no longer keeps one:
 * the document is the protocol's `pageDocument`, the same one the dev server
 * generates, so the built page and the dev page cannot drift apart. So the
 * entry is written where Vite's root expects it, built, and taken away again.
 *
 * It is written without a build identity: that belongs to the process that
 * serves it, and `server.ts` fills it in per process with `fillPage`.
 *
 * `finally` removes it, and it is gitignored as a second line of defence: a
 * leftover `page/index.html` would be a second answer to what the page says.
 */
const ROOT = import.meta.dirname
const ENTRY = join(ROOT, 'page', 'index.html')

writeFileSync(ENTRY, pageDocument(PAGE), 'utf8')
try {
  await build()
} finally {
  rmSync(ENTRY, { force: true })
}
