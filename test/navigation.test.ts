import { describe, expect, test } from 'bun:test'
import type { Answer } from '../atlas/connection.ts'
import { readTravel, travelWords, worthPressingAgain } from '../atlas/navigation.ts'

/**
 * Asking the host to move, and what each answer means.
 *
 * The case worth the whole file: a host that DECLINES answers `ok: true` with
 * `outcome: 'declined'`, because the call succeeded and the navigation did not.
 * Reading that as a failure is the mistake the protocol's own essay warns
 * against — it leaves this app unable to tell a host that refuses from a host
 * too old to have been asked, which are two different screens.
 */

const ok = (data: unknown): Answer => ({ ok: true, data })

describe('the three outcomes a host may report', () => {
  test('moved', () => {
    const travel = readTravel(ok({ outcome: 'moved', epic: 'off-means-off', why: '' }))
    expect(travel.outcome).toBe('moved')
    expect(travel.epic).toBe('off-means-off')
  })

  test('declined is a SUCCESSFUL call whose answer is no', () => {
    const travel = readTravel(ok({ outcome: 'declined', why: 'the reader is mid-edit' }))
    expect(travel.outcome).toBe('declined')
    expect(travel.why).toBe('the reader is mid-edit')
    // And it stays pressable, because trying again later is sensible.
    expect(worthPressingAgain(travel)).toBe(true)
  })

  test('no-such-target is not worth pressing again', () => {
    const travel = readTravel(ok({ outcome: 'no-such-target', why: 'no epic by that name' }))
    expect(travel.outcome).toBe('no-such-target')
    expect(worthPressingAgain(travel)).toBe(false)
  })

  test('the epic defaults to null when the host did not say where the reader ended up', () => {
    expect(readTravel(ok({ outcome: 'declined' })).epic).toBeNull()
  })
})

describe('when the call itself did not happen', () => {
  test('unknown-method is fatal, and is its own outcome', () => {
    // The one refusal the protocol says to treat as fatal. It must not read as
    // "declined", or every row on the page would go on offering to travel.
    const travel = readTravel({
      ok: false,
      reason: 'unknown-method',
      error: 'this host speaks protocol 1',
    })
    expect(travel.outcome).toBe('cannot-ask')
    expect(worthPressingAgain(travel)).toBe(false)
  })

  test('a failure is ordinary bad luck and stays pressable', () => {
    const travel = readTravel({ ok: false, reason: 'failed', error: 'the store is shut' })
    expect(travel.outcome).toBe('broke')
    expect(worthPressingAgain(travel)).toBe(true)
  })

  test('a timeout is bad luck too, not a refusal', () => {
    const travel = readTravel({ ok: false, reason: 'timed-out', error: 'no answer in 10000ms' })
    expect(travel.outcome).toBe('broke')
  })

  test('a refusal with no sentence still produces one', () => {
    expect(readTravel({ ok: false, reason: 'failed', error: '' }).why.length).toBeGreaterThan(0)
  })
})

describe('an answer that is not a navigation result', () => {
  test('is neither a move nor a refusal — it is broken', () => {
    // Assuming it moved would mark a row open that the reader is not looking
    // at; assuming it did not would leave somebody pressing a row that worked.
    for (const data of [null, 'moved', { outcome: 'teleported' }, {}, 42, []]) {
      const travel = readTravel(ok(data))
      expect(travel.outcome).toBe('broke')
    }
  })

  test('an outcome the protocol does not name is not passed through', () => {
    const travel = readTravel(ok({ outcome: 'sideways', epic: null, why: 'hm' }))
    expect(travel.outcome).toBe('broke')
  })
})

describe('the sentence a person reads', () => {
  test('a successful move says nothing at all', () => {
    // The screen changed. Narrating it would be this page describing something
    // already visible.
    expect(travelWords(readTravel(ok({ outcome: 'moved', epic: 'x', why: 'went there' })))).toBe('')
  })

  test('the host’s own words are preferred over anything written here', () => {
    const travel = readTravel(ok({ outcome: 'no-such-target', why: 'nothing here names gh#41' }))
    expect(travelWords(travel)).toBe('nothing here names gh#41')
  })

  test('a host that sent an outcome and no words still gets a sentence', () => {
    for (const outcome of ['declined', 'no-such-target']) {
      const travel = readTravel(ok({ outcome }))
      expect(travelWords(travel).length).toBeGreaterThan(0)
    }
  })
})
