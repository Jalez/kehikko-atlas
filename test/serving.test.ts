import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { answersAt } from '../doors.ts'
import { ID, PREFERRED_PORT } from '../manifest.ts'

/**
 * Where this program answers, and under which names.
 *
 * A host finds a module by sweeping a directory of registrations. Atlas used to
 * have no way to write one, so it was the one module a host's official list
 * named and a machine's registry did not.
 */

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

describe('the registration', () => {
  test('`bun register.ts` writes this module’s file, and only that, where a host sweeps', () => {
    /* A directory of the test's own: never the one a person's host reads. */
    const where = realpathSync(mkdtempSync(join(tmpdir(), 'atlas-registry-')))
    try {
      const register = (port: string) => Bun.spawnSync(['bun', 'register.ts'], { cwd: ROOT, env: { ...process.env, KEHIKOT_MODULES_DIR: where, PORT: port } })
      const written = () => JSON.parse(readFileSync(join(where, `${ID}.json`), 'utf8'))
      /* A `PORT` that names no port is not one. */
      expect(register('').exitCode).toBe(0)
      expect(readdirSync(where)).toEqual([`${ID}.json`])
      expect(written()).toEqual({ url: `http://127.0.0.1:${PREFERRED_PORT}`, dir: ROOT })
      expect(register('9531').exitCode).toBe(0)
      expect(written()).toEqual({ url: 'http://127.0.0.1:9531', dir: ROOT })
    } finally {
      rmSync(where, { recursive: true, force: true })
    }
  })

  test('the port a host is told is the one said in the manifest’s file', () => {
    expect(PREFERRED_PORT).toBe(7830)
  })
})

describe('the names the built page’s server answers under', () => {
  test('this machine, with or without a port', () => {
    for (const host of ['127.0.0.1:7830', '127.0.0.1', 'localhost:7830', 'LOCALHOST:7830', 'atlas.localhost:7830', '[::1]:7830']) {
      expect(answersAt(host)).toBe(true)
    }
  })

  test('nothing else: another name pointed at this machine, an address on a network, or none', () => {
    for (const host of ['example.com', 'example.com:7830', 'localhost.example.com', '127.0.0.1.example.com:7830', 'notlocalhost', '192.168.1.20:7830', '0.0.0.0:7830', '', 'a b']) {
      expect(answersAt(host)).toBe(false)
    }
    expect(answersAt(null)).toBe(false)
  })
})
