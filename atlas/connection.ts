import {
  MESSAGE,
  type ModuleContext,
  clampHeight,
  hostMessageSchema,
  looksLikeWireMessage,
} from 'roadmap-module-protocol'

/**
 * The four things this app is allowed to say, and everything it does with what
 * it hears.
 *
 * ## Why this file has no `window` in it
 *
 * Everything below is driven by two injected functions — `send`, and `later`
 * for timeouts — and receives its input through one method, `receive`. There is
 * no `window.parent`, no `addEventListener`, no `MessageEvent`. The browser
 * plumbing is thirty lines in `page/attach.ts`, and it is thirty lines with no
 * decisions in them.
 *
 * That split is not architecture for its own sake. The wire is the part of this
 * app where being wrong is silent: a correlation id that does not match hangs a
 * promise forever, a `goto` that goes unanswered hangs somebody else's
 * reference, and a message from the wrong sender that gets parsed anyway is a
 * page drawing a stranger's data. None of that produces an exception and none
 * of it is visible on screen. It has to be testable without a browser, and the
 * only way to make it testable without a browser is not to reach for one.
 *
 * ## Parse what the host sends, too
 *
 * `wire.ts` in the protocol package is explicit that this direction needs
 * checking as much as the other one: a framed page receives every message
 * posted at its window — from the host, from a dev server's hot-reload socket,
 * from anything else holding a handle. `looksLikeWireMessage` is the cheap
 * filter and `hostMessageSchema` is the real one, and a message that fails
 * either is dropped without a word. Notably it is dropped rather than reported:
 * a page that showed an error for every foreign postMessage would show an error
 * on every hot reload.
 *
 * ## What this app does NOT check, and must not claim to
 *
 * Origin. A module without `declares.storage` runs on an opaque origin, so
 * every message it receives from the host arrives with whatever origin the host
 * has, and the only identity that means anything is the window handle — which
 * this side cannot verify at all. There is no check available here that would
 * be an identity check, so there is none here pretending to be one. What
 * protects this app is that it holds nothing worth taking: no credential, no
 * store, no write path. A forged `roadmap.context` can make this page highlight
 * the wrong row, and that is the whole of the damage.
 */

/** How the host answered one question. */
export type Answer =
  | { ok: true; data: unknown }
  /**
   * `reason` widens the protocol's closed set by exactly one word, `timed-out`,
   * and the widening is marked here rather than hidden. The protocol's three
   * reasons are things a HOST said; `timed-out` is a thing this app decided,
   * and code branching on it should know the difference — nobody refused
   * anything, and the host may be about to answer.
   */
  | { ok: false; reason: 'unknown-module' | 'unknown-method' | 'failed' | 'timed-out'; error: string }

/**
 * How long this app waits for one answer.
 *
 * The protocol requires a timeout in the other direction — a host waiting on a
 * module's `went` must time out so a module cannot hang a reference — and says
 * nothing about this direction, because a host is not obliged to protect a
 * module from itself. It is still the same failure: a promise that never
 * settles is a page that shows a loading state forever, and "forever" is the
 * one duration a person cannot distinguish from a bug in this app.
 *
 * Ten seconds because a host listing its own epics is reading its own store, and a store that takes longer than ten seconds to list itself has a
 * problem this app cannot wait out.
 */
export const PATIENCE = 10_000

/** Cancel a scheduled callback. */
type Cancel = () => void

export interface ConnectionOptions {
  /** This module's own id, sent in `roadmap.ready` so a host can confirm what it framed. */
  moduleId: string
  /** Post one message to the host. */
  send: (message: unknown) => void
  /** Schedule a callback; returns its canceller. Injected so tests do not sleep. */
  later?: (fn: () => void, ms: number) => Cancel
  /** How long to wait for one answer. */
  patience?: number
  /** Mint a correlation id. Injected so tests can assert on a known id. */
  correlate?: () => string
}

export interface ConnectionEvents {
  /**
   * The greeting arrived. Carries the context that rides along with it, and
   * whatever the host is keeping for this module.
   *
   * The state is delivered HERE and nowhere else, because the greeting is the
   * only message that carries it — there is no "state changed" message and
   * there should not be, since the only thing that changes it is this app
   * asking. A page that wanted it later would have to have kept it from here
   * anyway.
   *
   * `null` when the host keeps nothing: a first run, a host that keeps nothing
   * for anybody, or a host that has forgotten. All three are the same sentence
   * to this app — draw the defaults — which is why they are one value.
   */
  onHello?: (
    context: ModuleContext,
    protocol: number,
    session: string,
    state: string | null,
  ) => void
  /** The reader moved. Sent on every switch, and on the greeting via `onHello`. */
  onContext?: (context: ModuleContext) => void
}

/**
 * What `receive` made of one inbound value. Returned for the tests and for the
 * page's own diagnostics; nothing in the app branches on it.
 */
export type Received =
  | 'not-ours'
  | 'malformed'
  | 'hello'
  | 'context'
  | 'response'
  | 'response-unmatched'
  | 'goto'
  /** A message this app understands and has nothing to do with. */
  | 'ignored'

export class Connection {
  private readonly moduleId: string
  private readonly send: (message: unknown) => void
  private readonly later: (fn: () => void, ms: number) => Cancel
  private readonly patience: number
  private readonly correlate: () => string
  private events: ConnectionEvents = {}

  /**
   * Questions waiting on an answer, keyed by correlation id.
   *
   * A `Map`. The key is a string this app minted, so the prototype hazard the
   * protocol package writes about does not strictly apply — but the LOOKUP is
   * keyed by a string that arrived from the host, in `receive`, and a host is
   * free to answer with `id: "constructor"`. On a plain object that lookup finds
   * a function, and the next line calls `.settle` on it. A Map has no prototype
   * chain to fall through, which is why the protocol package says to prefer one
   * wherever the code allows it. It does here.
   */
  private readonly waiting = new Map<string, { settle: (answer: Answer) => void; cancel: Cancel }>()

  private greeted = false
  private lastHeight = 0

  constructor(options: ConnectionOptions) {
    this.moduleId = options.moduleId
    this.send = options.send
    this.later =
      options.later ??
      ((fn, ms) => {
        const handle = setTimeout(fn, ms)
        return () => clearTimeout(handle)
      })
    this.patience = options.patience ?? PATIENCE
    this.correlate = options.correlate ?? (() => `atlas-${Math.random().toString(36).slice(2, 12)}`)
  }

  on(events: ConnectionEvents): void {
    this.events = events
  }

  /** Whether `roadmap.hello` has been heard. The page draws a different screen before it. */
  get hasBeenGreeted(): boolean {
    return this.greeted
  }

  /* -------------------------------------------------------------------- *
   * Inbound
   * -------------------------------------------------------------------- */

  /**
   * One value that arrived from the host.
   *
   * Takes the message DATA rather than a `MessageEvent`, because everything
   * this method decides is decided from the data, and taking the event would
   * mean a test has to build one.
   */
  receive(data: unknown): Received {
    if (!looksLikeWireMessage(data)) return 'not-ours'

    const parsed = hostMessageSchema.safeParse(data)
    if (!parsed.success) return 'malformed'
    const message = parsed.data

    switch (message.type) {
    case MESSAGE.HELLO: {
      /**
       * Answered on EVERY hello, not only the first. The protocol says a host
       * greets on every frame load, and a frame that reloaded has forgotten
       * the conversation — but this side cannot tell a reload from a host that
       * simply greeted twice, and the cost of answering twice is one extra
       * message while the cost of ignoring the second is a host that thinks
       * this module went silent.
       */
      this.greeted = true
      this.send({ type: MESSAGE.READY, id: this.moduleId, protocol: message.protocol })
      this.events.onHello?.(message.context, message.protocol, message.session, message.state)
      this.events.onContext?.(message.context)
      return 'hello'
    }
    case MESSAGE.CONTEXT: {
      /**
       * The context message is flat where the greeting nests one — an
       * inconsistency the protocol documents and keeps, because it is what both
       * halves already speak. Reshaped here so that everything downstream of
       * this class sees one context type and not two.
       *
       * ## Everything except the envelope, rather than a list of fields
       *
       * This used to name the three fields it wanted, which is a bug that fails
       * silently and gets worse with time. The protocol has since grown
       * `selection`, `pinned` and `prompt`; each arrived on the wire, was
       * visible in the message, and was dropped one line before anything could
       * act on it. Journeys had precisely this and it took a wire trace to
       * find, because there is nothing to see — no error, no warning, just a
       * field that is never there.
       *
       * So the message is passed through with only the envelope removed. A
       * field this app does not understand today reaches the code that might
       * tomorrow, and the next addition to the protocol needs no change here.
       */
      const { type: _envelope, protocol: _spoken, ...context } = message
      this.events.onContext?.(context)
      return 'context'
    }
    case MESSAGE.RESPONSE: {
      const pending = this.waiting.get(message.id)
      /**
       * An answer to a question nobody asked. Dropped, and dropped QUIETLY: it
       * is what a late answer looks like after this app gave up waiting, and it
       * is also what an answer to the previous page load looks like. Neither is
       * worth a word on screen.
       */
      if (!pending) return 'response-unmatched'
      this.waiting.delete(message.id)
      pending.cancel()
      pending.settle(
        message.ok
          ? { ok: true, data: message.data }
          : { ok: false, reason: message.reason, error: message.error },
      )
      return 'response'
    }
    case MESSAGE.GOTO: {
      /**
       * ## Why this app answers `went` with `found: false`, every time
       *
       * Atlas draws no references and no steps. It is a map of which projects
       * exist and which epics are in them, and there is nothing inside it for a
       * `goto` to land on — so the honest answer is that the walk found nothing.
       *
       * The temptation is to not answer at all, since the answer is always the
       * same. That would be the one genuinely harmful thing this app could do
       * to its host. The protocol is explicit: `goto` is the only place a host
       * waits on a module, and a host's reference index decides whether to walk
       * the reader in place or fall back to an ordinary link BY whether the
       * walk found anything. A module that stays silent makes every reference
       * pointing at it wait out the host's timeout before falling back. The
       * host is required to have that timeout, so nothing breaks — but a person
       * pressing a reference sits through it, once per press, for no reason.
       *
       * Answering immediately turns that into a link that works at once. The
       * `why` is a sentence rather than an empty string because the protocol
       * says the host may show it, and "this module draws no references" is a
       * better thing for somebody to read than a blank.
       */
      this.send({
        type: MESSAGE.WENT,
        id: message.id,
        found: false,
        why: 'Atlas is a map of projects and their epics; it draws no references or steps for a goto to land on.',
      })
      return 'goto'
    }
    case MESSAGE.EVENT: {
      /**
       * Something happened in another module on this canvas.
       *
       * Ignored, and ignored deliberately rather than by omission. This app
       * declares `extensions.consumes: []` — it consumes no format — so a
       * conforming host will never deliver one here at all, and a branch that
       * did something would be acting on a message this app told the host it
       * did not want.
       *
       * It is written out rather than left to a default because the switch is
       * exhaustive over the host messages, and exhaustiveness is what made the
       * ninth message show up here as a type error the moment the protocol grew
       * it. That is the behaviour worth keeping: the next message the protocol
       * adds should stop this file compiling and make somebody decide, rather
       * than falling into a silent default that swallows it.
       */
      return 'ignored'
    }
    }
  }

  /* -------------------------------------------------------------------- *
   * Outbound
   * -------------------------------------------------------------------- */

  /**
   * Ask the host one question.
   *
   * Never rejects. A rejected promise here would mean every caller has to
   * remember a try/catch around a thing that fails routinely — a refusal is not
   * exceptional, it is one of the two ordinary outcomes — and a caller that
   * forgot would turn a host saying no into an unhandled rejection.
   */
  ask(method: string, params: Record<string, unknown> = {}): Promise<Answer> {
    const id = this.correlate()
    return new Promise<Answer>((resolve) => {
      const cancel = this.later(() => {
        this.waiting.delete(id)
        resolve({
          ok: false,
          reason: 'timed-out',
          error: `the host did not answer ${method} within ${this.patience}ms`,
        })
      }, this.patience)
      this.waiting.set(id, { settle: resolve, cancel })
      this.send({ type: MESSAGE.REQUEST, id, method, params })
    })
  }

  /**
   * Ask for a frame this tall.
   *
   * Clamped on this side with the protocol's own `clampHeight` before sending,
   * which is not the check — the host runs its own copy over the raw value —
   * but does mean this app can predict what it will get instead of finding out
   * by watching its layout jump.
   *
   * Repeats are dropped. A resize observer fires on every layout pass and a
   * module posting an identical height sixty times a second is a module making
   * its host's message handler the busiest thing on the page.
   */
  resize(height: number): void {
    const asked = clampHeight(height)
    if (asked === this.lastHeight) return
    this.lastHeight = asked
    this.send({ type: MESSAGE.RESIZE, height: asked })
  }
}
