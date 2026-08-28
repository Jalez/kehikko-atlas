import { describe, expect, test } from 'bun:test'
import { MESSAGE, PROTOCOL } from 'roadmap-module-protocol'
import { Connection } from '../atlas/connection.ts'

/**
 * The wire, which is where being wrong is silent.
 *
 * Nothing in this file touches a browser. `Connection` takes a `send` function
 * and a `later` function and is driven by `receive(data)`, so every case below
 * is a plain object handed to a method — which is exactly the point of that
 * design, because the failures being tested here (a promise that never settles,
 * an answer matched to the wrong question, a `goto` nobody replied to) have no
 * symptom on screen and would never be caught by looking at the page.
 */

/** A connection with its clock and its ids under the test's control. */
function harness(patience = 1000) {
  const sent: any[] = []
  const timers: { fn: () => void; ms: number; cancelled: boolean }[] = []
  let n = 0

  const connection = new Connection({
    moduleId: 'roadmap.atlas',
    send: (message) => sent.push(message),
    patience,
    later: (fn, ms) => {
      const timer = { fn, ms, cancelled: false }
      timers.push(timer)
      return () => {
        timer.cancelled = true
      }
    },
    correlate: () => `id-${++n}`,
  })

  return {
    connection,
    sent,
    /** Fire every timer that has not been cancelled. */
    elapse: () => timers.filter((t) => !t.cancelled).forEach((t) => t.fn()),
    timers,
  }
}

const hello = {
  type: MESSAGE.HELLO,
  protocol: PROTOCOL,
  session: 'a-session',
  context: { epic: null, project: null, theme: 'light' },
}

describe('the greeting', () => {
  test('is answered with ready, carrying this module’s id', () => {
    const { connection, sent } = harness()
    expect(connection.receive(hello)).toBe('hello')
    expect(sent).toEqual([{ type: MESSAGE.READY, id: 'roadmap.atlas', protocol: PROTOCOL }])
    expect(connection.hasBeenGreeted).toBe(true)
  })

  test('is answered every time, because a reload is a greeting this side cannot see', () => {
    const { connection, sent } = harness()
    connection.receive(hello)
    connection.receive(hello)
    expect(sent).toHaveLength(2)
  })

  test('delivers the context that rides along with it', () => {
    const { connection } = harness()
    const heard: unknown[] = []
    connection.on({ onContext: (context) => heard.push(context) })
    connection.receive({ ...hello, context: { epic: 'x', project: 'P', theme: 'dark' } })
    /* The fields this app reads, rather than the whole object. The context
       schema fills in defaults for everything the protocol has grown since —
       `selection`, `pinned`, `prompt`, `kehikko` — and an exact match here
       would fail on every additive change to a message this test is not about. */
    expect(heard).toHaveLength(1)
    expect(heard[0]).toMatchObject({ epic: 'x', project: 'P', theme: 'dark' })
  })
})

describe('what is not a message for us', () => {
  test('anything without a roadmap. prefix is ignored', () => {
    const { connection, sent } = harness()
    expect(connection.receive({ type: 'vite:beforeUpdate' })).toBe('not-ours')
    expect(connection.receive('a string')).toBe('not-ours')
    expect(connection.receive(null)).toBe('not-ours')
    expect(connection.receive({ no: 'type' })).toBe('not-ours')
    expect(sent).toHaveLength(0)
  })

  test('a roadmap message with the wrong shape is dropped, not half-read', () => {
    const { connection, sent } = harness()
    expect(connection.receive({ type: MESSAGE.HELLO })).toBe('malformed')
    expect(connection.receive({ type: MESSAGE.CONTEXT, epic: 'NOT A SLUG' })).toBe('malformed')
    expect(sent).toHaveLength(0)
  })

  test('a module-direction message arriving from the host is not accepted', () => {
    // `hostMessageSchema` covers one direction only, which is what stops this
    // side from treating its own vocabulary as something it was told.
    const { connection } = harness()
    expect(connection.receive({ type: MESSAGE.READY, id: 'roadmap.atlas' })).toBe('malformed')
    expect(connection.receive({ type: MESSAGE.RESIZE, height: 400 })).toBe('malformed')
  })
})

describe('asking, and being answered', () => {
  test('a question goes out with a correlation id and the answer comes back on it', async () => {
    const { connection, sent } = harness()
    const answer = connection.ask('epics.list')
    expect(sent[0]).toEqual({ type: MESSAGE.REQUEST, id: 'id-1', method: 'epics.list', params: {} })

    connection.receive({ type: MESSAGE.RESPONSE, id: 'id-1', ok: true, data: [{ slug: 'x' }] })
    expect(await answer).toEqual({ ok: true, data: [{ slug: 'x' }] })
  })

  test('a refusal carries both the word and the sentence', async () => {
    const { connection } = harness()
    const answer = connection.ask('epics.list')
    connection.receive({
      type: MESSAGE.RESPONSE,
      id: 'id-1',
      ok: false,
      reason: 'unknown-method',
      error: 'this host does not answer epics.list',
    })
    expect(await answer).toEqual({
      ok: false,
      reason: 'unknown-method',
      error: 'this host does not answer epics.list',
    })
  })

  test('two questions in flight are answered independently, in any order', async () => {
    const { connection } = harness()
    const first = connection.ask('epics.list')
    const second = connection.ask('epic.get', { slug: 'x' })

    connection.receive({ type: MESSAGE.RESPONSE, id: 'id-2', ok: true, data: 'second' })
    connection.receive({ type: MESSAGE.RESPONSE, id: 'id-1', ok: true, data: 'first' })

    expect(await first).toEqual({ ok: true, data: 'first' })
    expect(await second).toEqual({ ok: true, data: 'second' })
  })

  test('an answer to a question nobody asked is dropped quietly', () => {
    const { connection } = harness()
    expect(connection.receive({ type: MESSAGE.RESPONSE, id: 'stale', ok: true, data: 1 })).toBe(
      'response-unmatched',
    )
  })

  test('an answer whose id is an inherited property name settles nothing', () => {
    // A plain object here would find `Object.prototype.constructor`, believe it
    // held a pending question, and call `.settle` on a function.
    const { connection } = harness()
    expect(
      connection.receive({ type: MESSAGE.RESPONSE, id: 'constructor', ok: true, data: 1 }),
    ).toBe('response-unmatched')
    expect(connection.receive({ type: MESSAGE.RESPONSE, id: '__proto__', ok: true, data: 1 })).toBe(
      'response-unmatched',
    )
  })

  test('a question that is never answered settles as timed-out rather than hanging', async () => {
    const { connection, elapse } = harness(1000)
    const answer = connection.ask('epics.list')
    elapse()
    expect(await answer).toEqual({
      ok: false,
      reason: 'timed-out',
      error: 'the host did not answer epics.list within 1000ms',
    })
  })

  test('an answer that arrives cancels the timeout', async () => {
    const { connection, timers } = harness()
    const answer = connection.ask('epics.list')
    connection.receive({ type: MESSAGE.RESPONSE, id: 'id-1', ok: true, data: [] })
    await answer
    expect(timers[0]?.cancelled).toBe(true)
  })

  test('a late answer after a timeout does not resettle the promise', async () => {
    const { connection, elapse } = harness(1000)
    const answer = connection.ask('epics.list')
    elapse()
    expect(await answer).toMatchObject({ reason: 'timed-out' })
    expect(connection.receive({ type: MESSAGE.RESPONSE, id: 'id-1', ok: true, data: [] })).toBe(
      'response-unmatched',
    )
  })

  test('asking never rejects, so no caller needs a catch', async () => {
    const { connection, elapse } = harness(1)
    const answer = connection.ask('epics.list')
    elapse()
    await expect(answer).resolves.toBeDefined()
  })
})

describe('goto, which this app must answer even though the answer is always the same', () => {
  test('a goto is answered at once with found: false and a sentence', () => {
    const { connection, sent } = harness()
    expect(connection.receive({ type: MESSAGE.GOTO, id: 'g-1', ref: 'gh#41' })).toBe('goto')
    expect(sent[0]).toMatchObject({ type: MESSAGE.WENT, id: 'g-1', found: false })
    expect(sent[0].why.length).toBeGreaterThan(0)
  })

  test('the answer carries the goto’s own id, so the host can pair it', () => {
    const { connection, sent } = harness()
    connection.receive({ type: MESSAGE.GOTO, id: 'correlate-me', step: 3 })
    expect(sent[0].id).toBe('correlate-me')
  })

  test('a goto naming neither a ref nor a step is malformed and gets no went', () => {
    // The protocol refuses it; answering a message this side could not parse
    // would mean inventing an id to answer on.
    const { connection, sent } = harness()
    expect(connection.receive({ type: MESSAGE.GOTO, id: 'g-1', slug: 'x' })).toBe('malformed')
    expect(sent).toHaveLength(0)
  })

  test('a goto is answered whether or not the module has been greeted', () => {
    // A host that never greeted still must not be left waiting out a timeout.
    const { connection, sent } = harness()
    connection.receive({ type: MESSAGE.GOTO, id: 'g-1', ref: 'gh#1' })
    expect(sent).toHaveLength(1)
  })
})

describe('resize', () => {
  test('a height goes out clamped to what the protocol allows', () => {
    const { connection, sent } = harness()
    connection.resize(10)
    expect(sent[0]).toEqual({ type: MESSAGE.RESIZE, height: 200 })
  })

  test('the ceiling is honoured too', () => {
    const { connection, sent } = harness()
    connection.resize(1_000_000)
    expect(sent[0]).toEqual({ type: MESSAGE.RESIZE, height: 20000 })
  })

  test('a repeated height is not sent twice', () => {
    // A ResizeObserver fires on every layout pass; without this the host's
    // message handler becomes the busiest thing on the page.
    const { connection, sent } = harness()
    connection.resize(640)
    connection.resize(640)
    connection.resize(640.4)
    expect(sent).toHaveLength(1)
  })

  test('a nonsense height becomes the floor rather than being posted as-is', () => {
    const { connection, sent } = harness()
    connection.resize(Number.NaN)
    expect(sent[0]).toEqual({ type: MESSAGE.RESIZE, height: 200 })
  })
})

describe('what this app never sends', () => {
  test('across a whole conversation, only ready, request, resize and went go out', () => {
    const { connection, sent } = harness()
    connection.receive(hello)
    void connection.ask('epics.list')
    connection.resize(800)
    connection.receive({ type: MESSAGE.GOTO, id: 'g', ref: 'gh#1' })
    connection.receive({
      type: MESSAGE.CONTEXT,
      protocol: PROTOCOL,
      epic: 'x',
      project: 'P',
      theme: 'dark',
    })

    const kinds = sent.map((m) => m.type)
    expect(kinds).toEqual([MESSAGE.READY, MESSAGE.REQUEST, MESSAGE.RESIZE, MESSAGE.WENT])
    // No invented message asking the host to move. There is no such message,
    // and this assertion is what stops one being added quietly.
    expect(kinds.some((k) => k.includes('take') || k.includes('open') || k.includes('goto'))).toBe(
      false,
    )
  })
})
