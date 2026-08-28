import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ModuleContext } from 'roadmap-module-protocol'
import type { Connection } from '../atlas/connection.ts'
import { PATIENCE } from '../atlas/connection.ts'
import { type Territory, intoProjects } from '../atlas/grouping.ts'
import { GOTO, LIST_EPICS } from '../atlas/methods.ts'
import { type Travel, readTravel } from '../atlas/navigation.ts'
import { readEpics } from '../atlas/reading.ts'
import { type Situation, situationOf } from '../atlas/situation.ts'
import { attach, isFramed, reportHeight } from './attach.ts'

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
  situation: Situation
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
}

export function useAtlas(): Atlas {
  const [situation, setSituation] = useState<Situation>(() =>
    isFramed() ? { kind: 'ungreeted' } : { kind: 'unframed' },
  )
  const [context, setContext] = useState<ModuleContext | null>(null)
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
  const connection = useRef<Connection | null>(null)

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
    const live = connection.current
    if (!live) return
    setSituation({ kind: 'asked' })
    const answer = await live.ask(LIST_EPICS)
    /*
     * An answer to a question asked by a connection that is gone is dropped.
     *
     * `StrictMode` mounts, unmounts and mounts again on purpose, so the first
     * mount opens a connection, asks for the epics and is thrown away with its
     * question still outstanding. That question does not vanish: it either
     * arrives or, ten seconds later, gives up — and either way it calls
     * `setSituation`, which is the same setter the surviving mount is using.
     *
     * What that looked like was a page that loaded, drew thirteen epics
     * correctly, and replaced them with "the host was asked and has not
     * answered" exactly ten seconds later. A lie about a host that had answered
     * twice, timed by a promise belonging to a component that no longer
     * existed — and the host's own logs were clean throughout, which is the
     * least helpful pair of symptoms available.
     */
    if (connection.current !== live) return
    if (!answer.ok) {
      setSituation(
        answer.reason === 'timed-out'
          ? { kind: 'unanswered', after: PATIENCE }
          : { kind: 'refused', reason: answer.reason, error: answer.error },
      )
      return
    }
    setSituation(situationOf(readEpics(answer.data)))
  }, [])

  useEffect(() => {
    if (!isFramed()) return

    const attached = attach({
      onHello: () => {
        void askForEpics()
      },
      onContext: (next) => setContext(next),
    })

    /*
     * The connection is stored BEFORE listening starts, and the order is
     * load-bearing rather than tidy.
     *
     * The mailbox replays anything that arrived before this effect ran, and it
     * replays synchronously — so `onHello` can fire inside `listen()`, on this
     * very line. `askForEpics` reads this ref. Listening first meant the
     * greeting arrived, found the ref still null, and returned without asking
     * anything, while `Connection` answered the host's greeting on its own. The
     * host saw a ready module; the module's own screen said nothing had
     * greeted it. See the essay on `Attached.listen`.
     */
    connection.current = attached.connection
    const stopListening = attached.listen()
    const stopReporting = reportHeight(attached.connection)

    return () => {
      stopReporting()
      stopListening()
      connection.current = null
    }
  }, [askForEpics])

  /**
   * The theme the host says it is in.
   *
   * Applied to the document element rather than to a wrapper, because the
   * shadcn tokens are defined on `:root` and `.dark`, and a class on a div would
   * leave the page's own background — painted by `body` — in the other theme. A
   * module one shade lighter than the page around it is worse than one that made
   * no attempt.
   *
   * With no host, no class is set at all, which lets the media query in
   * `styles.css` decide. That is the honest default: standalone, nobody has told
   * this app what theme to be in, and the reader's system is the only opinion
   * available.
   */
  useEffect(() => {
    if (!context) return
    const root = document.documentElement
    root.classList.toggle('dark', context.theme === 'dark')
    root.classList.toggle('light', context.theme === 'light')
  }, [context])

  const territory = useMemo(() => {
    if (situation.kind !== 'mapped') return null
    return intoProjects(situation.reading.epics, {
      epic: context?.epic ?? null,
      project: context?.project ?? null,
    })
  }, [situation, context])

  /**
   * Ask the host to show an epic.
   *
   * Null in three cases, and each of them is a case where offering would be a
   * lie: nothing is framing this page, the installed protocol has no navigation
   * method at all, or this host has already said it does not answer one. The
   * page draws the reason rather than a dead button.
   *
   * Nothing here marks the epic as open on success. `moved` is a promise that a
   * `roadmap.context` follows, and the context is what this app draws from — a
   * page that moved its own marker on the strength of the acknowledgement would
   * be drawing where it ASKED to be rather than where the reader is, and would
   * be wrong for as long as it took the host to disagree.
   */
  const travelTo = useMemo(() => {
    if (!isFramed() || !GOTO || cannotAsk) return null
    // Captured, so the closure below holds a `string` rather than the module
    // constant's `string | null` — the guard above has already settled it.
    const method = GOTO
    return (slug: string) => {
      const live = connection.current
      if (!live) return
      void (async () => {
        const travel = readTravel(await live.ask(method, { epic: slug }))
        if (travel.outcome === 'cannot-ask') setCannotAsk(true)
        setLastTravel({ slug, travel })
      })()
    }
  }, [cannotAsk])

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
      situation.kind === 'unanswered' ||
      situation.kind === 'unreadable' ||
      (situation.kind === 'refused' && situation.reason === 'failed')
    return worthIt ? () => void askForEpics() : null
  }, [situation, askForEpics])

  return { situation, context, territory, again, travelTo, lastTravel }
}
