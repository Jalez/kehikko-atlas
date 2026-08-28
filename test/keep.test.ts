import { describe, expect, test } from 'bun:test'
import { reading, writing } from '../atlas/keep.ts'

/**
 * The three states, and the round trip between them.
 *
 * The whole difficulty here is that `Chosen | null` has three values while the
 * kept string has to express four, because "nothing was kept" must stay
 * tellable from "the reader was at the unset position". Every test below is
 * really about that one distinction; see the essay in `atlas/keep.ts`.
 */

describe('the round trip', () => {
  test('the unset position survives, and is not confused with nothing kept', () => {
    const kept = writing(null)
    expect(reading(kept)).toBeNull()
    /* The distinction the whole file exists for: null is a remembered place,
       undefined is the absence of one. */
    expect(reading(null)).toBeUndefined()
  })

  test('the project list survives', () => {
    expect(reading(writing({ at: 'projects' }))).toEqual({ at: 'projects' })
  })

  test('a named project survives', () => {
    const there = { at: 'epics', project: { name: 'Roadmap' } } as const
    expect(reading(writing(there))).toEqual(there)
  })

  test('the unfiled group survives, because null is a project and not an absence', () => {
    const there = { at: 'epics', project: { name: null } } as const
    expect(reading(writing(there))).toEqual(there)
  })
})

describe('what the host hands back cannot be trusted', () => {
  test('nothing kept', () => {
    expect(reading(null)).toBeUndefined()
    expect(reading(undefined)).toBeUndefined()
    expect(reading('')).toBeUndefined()
  })

  test('not JSON at all', () => {
    expect(reading('{')).toBeUndefined()
    expect(reading('a filter, written by some older thing')).toBeUndefined()
  })

  test('JSON that is not an object', () => {
    expect(reading('42')).toBeUndefined()
    expect(reading('null')).toBeUndefined()
    expect(reading('["projects"]')).toBeUndefined()
  })

  test('a version this app no longer writes is dropped whole', () => {
    /* Dropped rather than half-read into the current shape. A remembered place
       that half-applies is worse than one that was forgotten. */
    expect(reading(JSON.stringify({ v: 0, at: 'projects' }))).toBeUndefined()
    expect(reading(JSON.stringify({ at: 'projects' }))).toBeUndefined()
  })

  test('a level that does not exist', () => {
    expect(reading(JSON.stringify({ v: 1, at: 'somewhere' }))).toBeUndefined()
  })

  test('an epics place with an unusable project name falls back to the list', () => {
    /* Not to the unfiled group, which is a real place the reader never chose. */
    expect(reading(JSON.stringify({ v: 1, at: 'epics', p: 7 }))).toEqual({ at: 'projects' })
    expect(reading(JSON.stringify({ v: 1, at: 'epics' }))).toEqual({ at: 'projects' })
  })

  test('reading never throws, whatever it is handed', () => {
    for (const value of [' ', '{"v":1,"at":{"at":"epics"}}', '[]', 'true', '"projects"']) {
      expect(() => reading(value)).not.toThrow()
    }
  })
})

describe('what is written', () => {
  test('an absurd project name is clipped rather than refused', () => {
    /* A page that could be made unable to save by a paste would be a page with
       a strange bug in it. The name is looked up against the current answer, so
       a clipped one simply fails to match and falls back to the project list. */
    const long = 'x'.repeat(5000)
    const written = writing({ at: 'epics', project: { name: long } })
    expect(written.length).toBeLessThan(400)
    expect(reading(written)).toEqual({ at: 'epics', project: { name: 'x'.repeat(200) } })
  })

  test('it stays far inside the four kilobytes the protocol allows', () => {
    expect(writing(null).length).toBeLessThan(64)
    expect(writing({ at: 'projects' }).length).toBeLessThan(64)
  })
})
