import { useEffect, useState } from 'react'
import type { Chosen } from '../atlas/chooser.ts'

/**
 * Where the reader has navigated to, held once for the whole page.
 *
 * ## Why this is not inside the component that draws it
 *
 * It was, until there were two components that draw it. The drill-down owned
 * `chosen` in a `useState`, which was right while the drill-down was the only
 * form with a trail to be at a point on; the short form asks the same two
 * questions in a different arrangement, and a second `useState` beside the
 * first would be two answers to "which project is the reader looking at",
 * updated by different gestures and going stale on their own schedules.
 *
 * That is not a hypothetical tidiness argument, because the two forms are BOTH
 * IN THE DOCUMENT at once — the layout is chosen by CSS, so the tree that is
 * not shown is not unmounted, it is `display: none`. Two states would therefore
 * not even be reset by the switch: a reader who picks a project in a short pane,
 * drags the pane tall, and finds the drill-down still at Home would be looking
 * at the other component's untouched copy. Lifting it makes the resize a change
 * of clothes rather than a change of mind.
 *
 * It also has to be one state because it is the state that is SAVED. The host
 * keeps one string for this module (`atlas/keep.ts`); two sources writing it
 * would mean the last gesture to fire wins, and which gesture that was would
 * depend on which layout happened to be visible.
 *
 * ## The two flags, and the third value
 *
 * `Chosen | null` has three values and `null` is not an absence — it means the
 * reader has not navigated, so the host's standing decides where the trail
 * opens. See the essays on `Chosen` in `atlas/chooser.ts` and on the round trip
 * in `atlas/keep.ts`. Everything below follows from that one fact.
 */
export interface Place {
  /** Where the reader has navigated, in the sense `Chosen` describes. */
  chosen: Chosen | null
  /** Navigate, and ask the host to remember it. The only way to move. */
  choose: (next: Chosen | null) => void
}

export function usePlace({
  remembered,
  remember,
}: {
  /** Where the reader was standing last time, if the host kept it. */
  remembered: Chosen | null | undefined
  /** Ask the host to keep where they are now. Null when nothing can keep it. */
  remember: ((chosen: Chosen | null) => void) | null
}): Place {
  const [chosen, setChosen] = useState<Chosen | null>(null)
  /**
   * Whether the place has been settled, either by the host's memory or by the
   * reader's own hand.
   *
   * It exists because `chosen` has no value that means "not seeded yet" —
   * `null` is already taken, and it means something specific. Without a second
   * flag the restore below would either be unable to restore `null`, or would
   * keep firing and stomp a reader who navigated before the greeting landed.
   *
   * Set by the reader's first gesture as well as by the restore, and that is
   * the important half: a greeting can arrive late, and a remembered place
   * arriving after somebody has already pressed Home would throw them back into
   * the project they had just left — the same bug the fix was for, running the
   * other way.
   */
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (settled || remembered === undefined) return
    setChosen(remembered)
    setSettled(true)
  }, [remembered, settled])

  /**
   * Every navigation on this page goes through here.
   *
   * One place, so that saving cannot be forgotten by a branch — or by a whole
   * second layout — added later, and so the settled flag cannot drift from the
   * state it guards.
   */
  const choose = (next: Chosen | null) => {
    setChosen(next)
    setSettled(true)
    remember?.(next)
  }

  return { chosen, choose }
}
