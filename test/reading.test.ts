import { describe, expect, test } from 'bun:test'
import { readEpic, readEpicDetail, readEpics } from '../atlas/reading.ts'

/**
 * What a host can send that this app has to survive.
 *
 * The protocol describes the SPINE of a list answer — a slug, and a bounded
 * title and project if they are there — and deliberately nothing past it, so
 * every case below is a real shape a conforming host is entitled to answer with.
 * The tests are written from that direction: not "does the parser work" but
 * "what does this app draw when the answer is like THIS", because the wrong
 * answer to that is a page that is confidently incorrect rather than one that
 * crashes.
 */

describe('the container the list arrives in', () => {
  test('a bare array', () => {
    const read = readEpics([{ slug: 'one' }, { slug: 'two' }])
    expect(read.shape).toBe('bare')
    expect(read.epics.map((e) => e.slug)).toEqual(['one', 'two'])
  })

  test('wrapped under a name', () => {
    const read = readEpics({ epics: [{ slug: 'one' }] })
    expect(read.shape).toBe('wrapped')
    expect(read.under).toBe('epics')
  })

  test('wrapped under the protocol’s older noun, for a host that has not been renamed yet', () => {
    const read = readEpics({ journeys: [{ slug: 'one' }] })
    expect(read.shape).toBe('wrapped')
    expect(read.under).toBe('journeys')
    expect(read.epics).toHaveLength(1)
  })

  test('an object with no array in it is unrecognised, not empty', () => {
    // The distinction the whole app turns on: this must not become a screen
    // that says the host has no epics.
    const read = readEpics({ total: 12, page: 1 })
    expect(read.shape).toBe('unrecognised')
    expect(read.offered).toBe(0)
  })

  test('a string, a number, null and undefined are all unrecognised', () => {
    for (const answer of ['nope', 7, null, undefined, true]) {
      expect(readEpics(answer).shape).toBe('unrecognised')
    }
  })

  test('an unrelated array on the object is not mistaken for the list', () => {
    // Hunting for "the first array-valued property" would pick up `tags` here
    // and draw two epics that do not exist.
    const read = readEpics({ tags: ['a', 'b'], count: 0 })
    expect(read.shape).toBe('unrecognised')
    expect(read.epics).toHaveLength(0)
  })

  test('an empty array is a readable answer with nothing in it', () => {
    const read = readEpics([])
    expect(read.shape).toBe('bare')
    expect(read.offered).toBe(0)
    expect(read.epics).toHaveLength(0)
  })
})

describe('one entry', () => {
  test('the fields the brief names are read', () => {
    const read = readEpic({
      slug: 'off-means-off',
      title: 'Off means off',
      lede: 'A switch that is off does nothing at all.',
      project: 'Roadmap',
      steps: 9,
    })
    expect(read).toEqual({
      epic: {
        slug: 'off-means-off',
        title: 'Off means off',
        lede: 'A switch that is off does nothing at all.',
        project: 'Roadmap',
        size: 9,
        unread: [],
      },
    })
  })

  test('an entry with no slug is refused rather than given one', () => {
    expect(readEpic({ title: 'Nameless' })).toEqual({ why: 'no slug' })
  })

  test('a slug that is not a slug is refused, not repaired', () => {
    // Bending it into shape would silently file the row under a different name.
    const read = readEpic({ slug: 'Not A Slug/../etc' })
    expect(read).toHaveProperty('why')
  })

  test('a slug longer than the protocol allows is refused', () => {
    expect(readEpic({ slug: 'a'.repeat(200) })).toHaveProperty('why')
  })

  test('non-objects are refused', () => {
    for (const entry of ['slug', 42, null, ['slug'], undefined]) {
      expect(readEpic(entry)).toEqual({ why: 'not an object' })
    }
  })

  test('a missing title is null, and never the string "undefined"', () => {
    const read = readEpic({ slug: 'x' })
    expect(read).toHaveProperty('epic')
    if (!('epic' in read)) return
    expect(read.epic.title).toBeNull()
    expect(read.epic.lede).toBeNull()
    expect(read.epic.project).toBeNull()
  })

  test('a title of the wrong type is absent, not coerced', () => {
    // `String(12345)` on screen as the name of an epic is the failure here.
    const read = readEpic({ slug: 'x', title: 12345, lede: { text: 'hi' }, project: ['A'] })
    if (!('epic' in read)) throw new Error('expected an epic')
    expect(read.epic.title).toBeNull()
    expect(read.epic.lede).toBeNull()
    expect(read.epic.project).toBeNull()
  })

  test('an empty string is the same as absent', () => {
    const read = readEpic({ slug: 'x', title: '   ', lede: '', project: '  ' })
    if (!('epic' in read)) throw new Error('expected an epic')
    expect(read.epic.title).toBeNull()
    expect(read.epic.lede).toBeNull()
    expect(read.epic.project).toBeNull()
  })

  test('prose is clipped rather than refused', () => {
    const read = readEpic({ slug: 'x', title: 'T'.repeat(5000) })
    if (!('epic' in read)) throw new Error('expected an epic')
    expect(read.epic.title).not.toBeNull()
    expect(read.epic.title!.length).toBeLessThan(5000)
  })
})

describe('size, which is absent far more often than it is zero', () => {
  const sizeOf = (entry: unknown) => {
    const read = readEpic(entry)
    if (!('epic' in read)) throw new Error('expected an epic')
    return read.epic.size
  }

  test('a number of steps', () => {
    expect(sizeOf({ slug: 'x', steps: 12 })).toBe(12)
  })

  test('an array of steps is counted', () => {
    expect(sizeOf({ slug: 'x', steps: [{}, {}, {}] })).toBe(3)
  })

  test('`size` is read when `steps` is not there', () => {
    expect(sizeOf({ slug: 'x', size: 4 })).toBe(4)
  })

  test('a host that said nothing about size leaves it null, not zero', () => {
    // The single most important assertion in this file. Null draws nothing;
    // zero would draw "0 steps", which is this app inventing a fact.
    expect(sizeOf({ slug: 'x' })).toBeNull()
  })

  test('genuinely zero steps is zero, and is different from silence', () => {
    expect(sizeOf({ slug: 'x', steps: 0 })).toBe(0)
    expect(sizeOf({ slug: 'x', steps: [] })).toBe(0)
  })

  test('a nonsense count is read as absent', () => {
    expect(sizeOf({ slug: 'x', steps: -3 })).toBeNull()
    expect(sizeOf({ slug: 'x', steps: 2.5 })).toBeNull()
    expect(sizeOf({ slug: 'x', steps: 'many' })).toBeNull()
    expect(sizeOf({ slug: 'x', steps: null })).toBeNull()
  })
})

describe('fields nobody promised', () => {
  test('extra fields do not refuse the entry, and are recorded', () => {
    const read = readEpic({ slug: 'x', title: 'X', owner: 'jo', labels: ['a'], stage: 'in-review' })
    if (!('epic' in read)) throw new Error('expected an epic')
    expect(read.epic.title).toBe('X')
    expect(read.epic.unread.sort()).toEqual(['labels', 'owner', 'stage'])
  })
})

describe('the prototype hazard, which arrives from the same place the data does', () => {
  test('an entry whose slug is an inherited name is still refused for the right reason', () => {
    // `entry.slug` on a plain object with no own `slug` must not find
    // `Object.prototype`'s anything. It does not, but the assertion is here so
    // that a rewrite of `field()` cannot quietly reintroduce it.
    expect(readEpic({})).toEqual({ why: 'no slug' })
  })

  test('an entry carrying `constructor` and `__proto__` as ordinary fields', () => {
    const entry = JSON.parse('{"slug":"x","constructor":"c","__proto__":{"title":"injected"}}')
    const read = readEpic(entry)
    if (!('epic' in read)) throw new Error('expected an epic')
    // The injected title must not appear, and nothing must throw.
    expect(read.epic.title).toBeNull()
    expect(read.epic.slug).toBe('x')
  })

  test('a project named `constructor` groups as an ordinary project name', () => {
    const read = readEpic({ slug: 'x', project: 'constructor' })
    if (!('epic' in read)) throw new Error('expected an epic')
    expect(read.epic.project).toBe('constructor')
  })
})

describe('a half-readable answer is reported, not quietly shortened', () => {
  test('unreadable entries are counted and explained', () => {
    const read = readEpics([{ slug: 'one' }, { title: 'no slug' }, 'nope', { slug: 'two' }])
    expect(read.offered).toBe(4)
    expect(read.epics.map((e) => e.slug)).toEqual(['one', 'two'])
    expect(read.skipped).toHaveLength(2)
    expect(read.skipped[0]).toEqual({ at: 1, why: 'no slug' })
    expect(read.skipped[2 - 1]).toEqual({ at: 2, why: 'not an object' })
  })

  test('a repeated slug is kept once and recorded', () => {
    const read = readEpics([{ slug: 'one' }, { slug: 'one', title: 'again' }])
    expect(read.epics).toHaveLength(1)
    expect(read.skipped[0]?.why).toContain('a second entry')
  })

  test('an answer of nothing but rubbish yields entries offered and none read', () => {
    const read = readEpics([1, 2, 3])
    expect(read.offered).toBe(3)
    expect(read.epics).toHaveLength(0)
    expect(read.skipped).toHaveLength(3)
  })
})

describe('one epic in more detail', () => {
  test('a bare object', () => {
    const read = readEpicDetail({ slug: 'x', title: 'X', steps: [{}, {}] })
    if (!('epic' in read)) throw new Error('expected an epic')
    expect(read.epic.size).toBe(2)
  })

  test('wrapped, in either noun', () => {
    for (const wrapper of ['epic', 'journey']) {
      const read = readEpicDetail({ [wrapper]: { slug: 'x', title: 'X' } })
      if (!('epic' in read)) throw new Error('expected an epic')
      expect(read.epic.title).toBe('X')
    }
  })

  test('a detail answer richer than the list answer keeps the surplus visible', () => {
    const read = readEpicDetail({ slug: 'x', body: 'a long prose body', refs: ['gh#41'] })
    if (!('epic' in read)) throw new Error('expected an epic')
    expect(read.epic.unread.sort()).toEqual(['body', 'refs'])
  })
})


describe('the spine the protocol does describe', () => {
  test('an answer in the agreed shape is read through it', () => {
    // `{ epics: [...] }` is what `epicsListResult` names, and a host that
    // answers exactly that must never be read by the guesswork underneath.
    const read = readEpics({ epics: [{ slug: 'one', title: 'One', project: 'P' }] })
    expect(read.shape).toBe('wrapped')
    expect(read.under).toBe('epics')
    expect(read.epics[0]?.title).toBe('One')
  })

  test('the spine passes surplus fields through, and they are recorded as unread', () => {
    const read = readEpics({ epics: [{ slug: 'one', lede: 'a lede', owner: 'jo' }] })
    expect(read.epics[0]?.lede).toBe('a lede')
    expect(read.epics[0]?.unread).toEqual(['owner'])
  })

  test('a host answering outside the spine is still read, not refused', () => {
    // The package README is emphatic that running one of its schemas is a
    // convenience rather than the check. A bare array is a reasonable reading
    // of the method, and refusing it would be tidiness over the map.
    const read = readEpics([{ slug: 'one' }])
    expect(read.shape).toBe('bare')
    expect(read.epics).toHaveLength(1)
  })

  test('an entry the spine refuses does not take the whole answer down with it', () => {
    // One bad slug makes `epicsListResult` fail; the fallback walk then reads
    // the good entries and records the bad one.
    const read = readEpics({ epics: [{ slug: 'one' }, { slug: 'NOT A SLUG' }] })
    expect(read.epics.map((e) => e.slug)).toEqual(['one'])
    expect(read.skipped).toHaveLength(1)
  })
})
