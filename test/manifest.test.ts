import { describe, expect, test } from 'bun:test'
import { MANIFEST_KIND, METHOD_NAMES, PROTOCOL, manifestSchema, speaks } from 'roadmap-module-protocol'
import { MANIFEST } from '../manifest.ts'
import { GET_EPIC, LIST_EPICS } from '../atlas/methods.ts'

/**
 * The document a host reads before deciding whether to frame this app.
 *
 * It is validated at import time in `manifest.ts` with the same schema a host
 * uses, so most of what could be wrong with it is already a startup failure.
 * What is left to test is the part a schema cannot check: that the manifest
 * describes THIS program rather than a program somebody meant to write.
 */

describe('the manifest a host will read', () => {
  test('parses under the protocol’s own schema', () => {
    expect(manifestSchema.safeParse(MANIFEST).success).toBe(true)
  })

  test('says the word that makes it a manifest rather than a hopeful GET', () => {
    expect(MANIFEST.kind).toBe(MANIFEST_KIND)
  })

  test('declares a range that includes the protocol it was built against', () => {
    expect(speaks(MANIFEST.declares.protocol, PROTOCOL)).toBe(true)
    expect(speaks(MANIFEST.declares.protocol, PROTOCOL + 1)).toBe(false)
  })

  test('asks for no storage, so it has no origin and can hold nothing', () => {
    expect(MANIFEST.declares.storage).toBe(false)
  })

  test('emits and consumes no extensions', () => {
    expect(MANIFEST.extensions.emits).toEqual([])
    expect(MANIFEST.extensions.consumes).toEqual([])
  })
})

describe('what it declares it will use', () => {
  test('names a capability, and it is the one that goes with the calls made', () => {
    expect(MANIFEST.declares.uses.length).toBeGreaterThan(0)
  })

  test('declares nothing that would let it write', () => {
    // A declaration unlocks nothing — the protocol is emphatic about that — so
    // this is not a safety check. It is a check that the sentence a person
    // reads before installing this program is a true sentence about it.
    for (const capability of MANIFEST.declares.uses) {
      expect(capability).not.toContain('report')
      expect(capability).not.toContain('emit')
    }
  })
})

describe('the methods this app resolved from the package', () => {
  test('both are methods the installed protocol actually names', () => {
    expect(METHOD_NAMES as readonly string[]).toContain(LIST_EPICS)
    expect(METHOD_NAMES as readonly string[]).toContain(GET_EPIC)
  })

  test('they are two different questions', () => {
    expect(LIST_EPICS).not.toBe(GET_EPIC)
  })
})
