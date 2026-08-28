import { describe, expect, test } from 'bun:test'
import { type Situation, situationOf, words } from '../atlas/situation.ts'
import { readEpics } from '../atlas/reading.ts'

/**
 * The states of absence, which are the states this app is judged on.
 *
 * Six different facts produce an empty screen and only one of them is about the
 * work. These tests assert that the six stay six: that no two of them share a
 * sentence, that the five which are about the conversation never claim there is
 * nothing, and that the one which is about the work says so plainly.
 */

const every: Situation[] = [
  { kind: 'unframed' },
  { kind: 'ungreeted' },
  { kind: 'asked' },
  { kind: 'refused', reason: 'failed', error: 'the store is not open' },
  { kind: 'unanswered', after: 10_000 },
  { kind: 'unreadable', reading: readEpics({ nope: true }) },
  { kind: 'none' },
  { kind: 'mapped', reading: readEpics([{ slug: 'x' }]) },
]

describe('every state has words, and no two share them', () => {
  test('each one produces a headline and a body', () => {
    for (const situation of every) {
      const said = words(situation)
      expect(said.headline.length).toBeGreaterThan(0)
      expect(said.body.length).toBeGreaterThan(0)
      expect(said.headline.endsWith('.')).toBe(true)
    }
  })

  test('the headlines are all different', () => {
    const headlines = every.map((s) => words(s).headline)
    expect(new Set(headlines).size).toBe(headlines.length)
  })

  test('the bodies are all different', () => {
    const bodies = every.map((s) => words(s).body)
    expect(new Set(bodies).size).toBe(bodies.length)
  })
})

describe('nothing but `none` says there is nothing', () => {
  const aboutTheConversation: Situation[] = [
    { kind: 'unframed' },
    { kind: 'ungreeted' },
    { kind: 'asked' },
    { kind: 'refused', reason: 'failed', error: '' },
    { kind: 'unanswered', after: 10_000 },
    { kind: 'unreadable', reading: readEpics(null) },
  ]

  test('none of the five absences claims the roadmap is empty', () => {
    // Naive substring matching is not enough here, because the most careful of
    // these sentences says "this is NOT a roadmap with no projects in it" —
    // which contains the phrase in order to deny it. So the check is for the
    // assertion, not the words: a sentence that says the roadmap is empty
    // without the host having said so.
    for (const situation of aboutTheConversation) {
      const said = words(situation)
      const both = `${said.headline} ${said.body}`.toLowerCase()
      expect(both).not.toContain('there are no projects')
      expect(both).not.toContain('no epics exist')
      expect(both).not.toContain('nothing to show')
      expect(both).not.toContain('this roadmap is empty')
    }
  })

  test('each of them says, in some form, that this app was not told', () => {
    for (const situation of aboutTheConversation) {
      const both = `${words(situation).headline} ${words(situation).body}`.toLowerCase()
      const admitsIgnorance =
        both.includes('told') ||
        both.includes('has not answered') ||
        both.includes('not come back') ||
        both.includes('refused') ||
        both.includes('could not read')
      expect(admitsIgnorance).toBe(true)
    }
  })

  test('`none` is the one that says there is nothing, and says the host said so', () => {
    const said = words({ kind: 'none' })
    expect(said.headline).toBe('The host answered: it has no epics yet.')
    expect(said.body).toContain('really does mean there is nothing')
    expect(said.body).toContain('the host answered')
  })

  test('with no host, the sentence is about nobody having spoken', () => {
    const said = words({ kind: 'unframed' })
    expect(said.headline).toBe('Nothing has told this app anything.')
    expect(said.body).toContain('not a roadmap with no projects in it')
  })
})

describe('a refusal is quoted, not summarised', () => {
  test('the protocol’s word appears in the sentence', () => {
    expect(words({ kind: 'refused', reason: 'unknown-method', error: '' }).body).toContain(
      'unknown-method',
    )
  })

  test('the sentence says the refusal is about the question, not the work', () => {
    const body = words({ kind: 'refused', reason: 'failed', error: '' }).body
    expect(body).toContain('about the question and not about the work')
  })
})

describe('which situation an answer puts this app in', () => {
  test('epics that could be read make a map', () => {
    expect(situationOf(readEpics([{ slug: 'x' }])).kind).toBe('mapped')
  })

  test('an empty list from a readable answer is `none`', () => {
    expect(situationOf(readEpics([])).kind).toBe('none')
    expect(situationOf(readEpics({ epics: [] })).kind).toBe('none')
  })

  test('an answer with no list in it is unreadable, never `none`', () => {
    // The distinction the app exists to keep: this must not become "no epics".
    expect(situationOf(readEpics({ total: 4 })).kind).toBe('unreadable')
    expect(situationOf(readEpics(null)).kind).toBe('unreadable')
    expect(situationOf(readEpics('sorry')).kind).toBe('unreadable')
  })

  test('entries that were offered and none readable is unreadable, not empty', () => {
    // The host plainly has four of something. Saying "no epics yet" here would
    // blame the roadmap for a failure on this side of the frame.
    expect(situationOf(readEpics([1, 2, 3, 4])).kind).toBe('unreadable')
  })

  test('a partly readable answer is still a map', () => {
    const situation = situationOf(readEpics([{ slug: 'x' }, 'rubbish']))
    expect(situation.kind).toBe('mapped')
    if (situation.kind !== 'mapped') return
    expect(situation.reading.skipped).toHaveLength(1)
  })
})

describe('the timeout sentence', () => {
  test('names how long this app waited, in seconds', () => {
    expect(words({ kind: 'unanswered', after: 10_000 }).body).toContain('10 seconds')
  })

  test('does not claim the host will never answer', () => {
    const body = words({ kind: 'unanswered', after: 10_000 }).body
    expect(body).toContain('may yet reply')
  })
})
