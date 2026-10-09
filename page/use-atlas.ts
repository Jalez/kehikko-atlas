import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clampHeight, type ModuleContext } from 'kehikot-module-protocol'
import { HostRefused } from 'kehikot-module-protocol/client'
import { useHost, type KeptCodec, type Where } from 'kehikot-module-protocol/client/react'
import { type Territory, intoProjects } from '../atlas/grouping.ts'
import type { Chosen } from '../atlas/chooser.ts'
import { reading, writing } from '../atlas/keep.ts'
import { GOTO, KEEP_STATE, LIST_EPICS } from '../atlas/methods.ts'
import { ID } from '../manifest.ts'
import { type Answer, type Travel, readTravel } from '../atlas/navigation.ts'
import { readEpics } from '../atlas/reading.ts'
import { type Situation, situationOf } from '../atlas/situation.ts'

/**
 * How long a question waits for its answer before this app says it gave up.
 *
 * Ten seconds: long enough that a host doing real work answers inside it,
 * short enough that a page does not look like it is still loading after a
 * person has stopped believing it.
 */
export const PATIENCE = 10_000

/**
 * Whether anything is framing this page.
 *
 * `window.parent === window` is how a top-level document looks: a browsing
 * context with no parent is its own parent. It decides one thing — whether the
 * page says its own name — and not whether a host is there: that is `where`.
 */
export function isFramed(): boolean {
  return typeof window !== 'undefined' && window.parent !== window
}

/**
 * The place a host keeps for this app, read through `atlas/keep.ts`, which
 * distrusts it. Wrapped because `null` is a real place here — the reader was at
 * the unset position — and the hook's own `null` means nothing was kept.
 */
type Kept = { chosen: Chosen | null }
const KEPT: KeptCodec<Kept> = {
  read: (state) => {
    const chosen = reading(state)
    return chosen === undefined ? null : { chosen }
  },
  write: (kept) => writing(kept.chosen),
}

/** What a `goto` is told. Always the same, and still owed: a host waits on the answer. */
const NOWHERE_TO_GO = 'Atlas is a map of projects and their epics; it draws no references or steps for a goto to land on.'

/**
 * One question, as an `Answer` and never a rejection.
 *
 * The protocol client rejects with `HostRefused`; `silent` is its word for a
 * question that was sent and not answered in time, which is this app's
 * `timed-out` and its own screen.
 */
async function asked(question: Promise<unknown>): Promise<Answer> {
  try {
    return { ok: true, data: await question }
  } catch (error) {
    if (!(error instanceof HostRefused)) return { ok: false, reason: 'failed', error: 'This app failed while reading the host’s answer.' }
    const { reason, error: said } = error.refusal
    return { ok: false, reason: reason === 'silent' ? 'timed-out' : reason, error: said }
  }
}

/**
 * The whole of this app's state, in one hook.
 *
 * Four things and no more: which situation the app is in, what the host said
 * about where the reader is standing, the territory derived from the one
 * answer, and what became of the last attempt to travel. Everything else on
 * screen is a function of those.
 *
 * ## Why the situation is a state and the territory is a derivation
 *
 * The territory is `intoProjects(epics, context)` and nothing else — no
 * ordering held in a ref, no memo of a memo, no second copy that a context
 * message updates in place. It is recomputed whenever either input changes,
 * which is a few dozen array pushes over a list a person has to be able to
 * read, so the cost is nothing and the property bought is worth a great deal:
 * there is no way for the map on screen to disagree with the answer it came
 * from, because there is only one map and it is a pure function of the answer.
 *
 * The situation cannot be derived the same way, because it is a fact about the
 * CONVERSATION rather than about the data — "the host has not spoken yet" and
 * "the host answered with nothing" produce the same empty list and are
 * different screens. So it is held, moved deliberately at each step, and never
 * inferred from whether some array is empty.
 */
export interface Atlas {
  /** Whether anything is framing this page: waiting to hear, nobody there, or a host. */
  where: Where
  /** The situation, once a host has greeted this page and been asked. `null` before that. */
  situation: Situation | null
  /** The context as last heard. Null until the greeting arrives, or forever if it never does. */
  context: ModuleContext | null
  /** The map, when there is one. */
  territory: Territory | null
  /** Ask the question again. Offered only where asking again could plausibly help. */
  again: (() => void) | null
  /** Ask the host to show one epic. Null when nothing could possibly answer. */
  travelTo: ((slug: string) => void) | null
  /** What became of the last attempt, and which epic it was about. */
  lastTravel: { slug: string; travel: Travel } | null
  /**
   * Where the reader was standing when they were last here.
   *
   * Three values, and the third is the reason this is not a `Chosen | null`.
   * `undefined` means nothing was kept and the drill-down should not be
   * touched; `null` means the reader really was at the unset position and that
   * is what should be restored. See the essay in `atlas/keep.ts`.
   */
  remembered: Chosen | null | undefined
  /**
   * Ask the host to remember where the reader is now. Null when no host could
   * keep it, in which case the page simply does not remember — there is no
   * affordance on screen to go false, so nothing needs saying.
   */
  remember: ((chosen: Chosen | null) => void) | null
}

export function useAtlas(): Atlas {
  const [situation, setSituation] = useState<Situation | null>(null)
  const [lastTravel, setLastTravel] = useState<Atlas['lastTravel']>(null)
  /**
   * Set once a host has answered `unknown-method` to a navigation call.
   *
   * Sticky on purpose. That refusal is the one the protocol says to treat as
   * fatal — this host does not have the method and will not grow one while the
   * page is open — so every row stops offering to travel rather than each one
   * discovering the same no for itself. A reader pressing five rows and getting
   * five identical refusals would reasonably conclude the app is broken.
   */
  const [cannotAsk, setCannotAsk] = useState(false)
  /** The question in flight, by number: only the newest one's answer becomes the page. */
  const asking = useRef(0)

  /**
   * The host: the protocol's `useHost`, which is the connection, the grace
   * before "nobody is there", the theme on `<html>` and the kept place. It
   * accepts a greeting from whatever window gives one, so this page opened on
   * its own is waited on for a moment and then says nothing is framing it.
   *
   * The theme goes on the document element rather than on a wrapper, because
   * the shadcn tokens are defined on `:root` and `.dark`, and a class on a div
   * would leave the page's own background — painted by `body` — in the other
   * theme.
   */
  const host = useHost<Kept>(
    ID,
    {
      /* The kept place is already in the hook's standing by the time this is
         called, so the drill-down is seeded before there is a territory to
         draw with it. */
      onHello: () => void askForEpics(),
      onGoto: (_goto, answer) => answer(false, NOWHERE_TO_GO),
    },
    { kept: KEPT, answerWithin: PATIENCE },
  )
  const { context, where, request, resize } = host

  /**
   * Ask, and turn the answer into a situation.
   *
   * The four outcomes are kept apart here rather than collapsed into
   * success/failure, because three of them are absences with different
   * sentences and the fourth splits again inside `situationOf`. This function is
   * where an `if (!ok) setError()` would have quietly destroyed the honesty the
   * rest of the app is built on.
   */
  const askForEpics = useCallback(async () => {
    const mine = (asking.current += 1)
    setSituation({ kind: 'asked' })
    const answer = await asked(request(LIST_EPICS))
    /*
     * An answer to a question that is no longer the newest is dropped.
     *
     * `StrictMode` mounts, unmounts and mounts again on purpose, so the first
     * mount hears the greeting, asks for the epics and is thrown away with its
     * question still outstanding. That question does not vanish: it either
     * arrives or, ten seconds later, gives up — and either way it calls
     * `setSituation`, which is the same setter the surviving mount is using.
     *
     * What that looked like was a page that loaded, drew thirteen epics
     * correctly, and replaced them with "the host was asked and has not
     * answered" exactly ten seconds later. A lie about a host that had answered
     * twice, timed by a promise belonging to a connection that no longer
     * existed — and the host's own logs were clean throughout, which is the
     * least helpful pair of symptoms available.
     */
    if (asking.current !== mine) return
    if (!answer.ok) {
      setSituation(
        answer.reason === 'timed-out'
          ? { kind: 'unanswered', after: PATIENCE }
          : { kind: 'refused', reason: answer.reason, error: answer.error },
      )
      return
    }
    setSituation(situationOf(readEpics(answer.data)))
  }, [request])

  /**
   * Say how tall this page would like to be, whenever that changes.
   *
   * Observed rather than computed, because the height is a fact about layout
   * and layout is the browser's. Advisory, like every resize: the host bounds
   * it and may ignore it entirely, and nothing on this page depends on the
   * answer. A repeated height is not sent twice — an observer fires for more
   * than this page cares about.
   */
  useEffect(() => {
    let last = 0
    const observer = new ResizeObserver(() => {
      const height = clampHeight(document.documentElement.scrollHeight)
      if (height === last) return
      last = height
      resize(height)
    })
    observer.observe(document.documentElement)
    return () => {
      observer.disconnect()
      /* The question goes with the page that asked it. */
      asking.current += 1
    }
  }, [resize])

  const territory = useMemo(() => {
    if (situation?.kind !== 'mapped') return null
    return intoProjects(situation.reading.epics, {
      epic: context?.epic ?? null,
      project: context?.project ?? null,
    })
  }, [situation, context])

  /**
   * Ask the host to show an epic.
   *
   * Null in three cases, and each of them is a case where offering would be a
   * lie: no host has greeted this page, the installed protocol has no navigation
   * method at all, or this host has already said it does not answer one. The
   * page draws the reason rather than a dead button.
   *
   * Nothing here marks the epic as open on success. `moved` is a promise that a
   * `kehikot.context` follows, and the context is what this app draws from — a
   * page that moved its own marker on the strength of the acknowledgement would
   * be drawing where it ASKED to be rather than where the reader is, and would
   * be wrong for as long as it took the host to disagree.
   */
  const travelTo = useMemo(() => {
    if (where !== 'hosted' || !GOTO || cannotAsk) return null
    // Captured, so the closure below holds a `string` rather than the module
    // constant's `string | null` — the guard above has already settled it.
    const method = GOTO
    return (slug: string) => {
      void (async () => {
        const travel = readTravel(await asked(request(method, { epic: slug })))
        if (travel.outcome === 'cannot-ask') setCannotAsk(true)
        setLastTravel({ slug, travel })
      })()
    }
  }, [where, cannotAsk, request])

  /**
   * Hand the place to the host to keep.
   *
   * Fire-and-forget, deliberately. There is nothing useful to do with a refusal
   * — the reader has already navigated, the screen is already correct, and the
   * only consequence of a failed save is that the next visit opens where the
   * last successful save said. Surfacing that would be an error message about a
   * convenience nobody was promised.
   *
   * The hook holds what was handed over as well as sending it, which changes
   * nothing on screen: where the reader is now is the drill-down's own state
   * (`place.ts`), and it stops listening to `remembered` once it has settled.
   */
  const keep = host.remember
  const remember = useMemo(() => {
    if (where !== 'hosted' || !KEEP_STATE) return null
    return (chosen: Chosen | null) => keep({ chosen })
  }, [where, keep])

  /**
   * Whether asking the list question again is worth offering.
   *
   * Only where a second attempt could plausibly answer differently. A host that
   * said `unknown-method` will say it again — the protocol calls that the one
   * refusal a module author should treat as fatal — and a button that re-runs a
   * question with a known answer is a button that teaches somebody to press it
   * twice before believing the screen. Nothing is offered when there is no host
   * at all, for the plainest reason: there is nobody to ask.
   */
  const again = useMemo(() => {
    const worthIt =
      situation?.kind === 'unanswered' ||
      situation?.kind === 'unreadable' ||
      (situation?.kind === 'refused' && situation.reason === 'failed')
    return worthIt ? () => void askForEpics() : null
  }, [situation, askForEpics])

  /* Undefined until a greeting has been read, and afterwards too when the host
     kept nothing. Both mean the same thing to the drill-down — do not touch it. */
  const remembered = where === 'hosted' && host.kept ? host.kept.chosen : undefined

  return { where, situation, context, territory, again, travelTo, lastTravel, remembered, remember }
}
