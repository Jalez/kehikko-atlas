import type { Chosen } from './chooser.ts'

/**
 * Where the reader had navigated to, kept between sessions.
 *
 * ## Why the host holds it and this app does not
 *
 * This app declares no storage, deliberately — see `manifest.ts`. A module
 * framed without `allow-same-origin` runs on an opaque origin, where
 * `localStorage` does not return nothing, it THROWS. So there is nowhere here
 * to put a breadcrumb.
 *
 * `state.set` is the protocol's answer: the host keeps one string for one
 * module and hands the same string back on the greeting, having never looked
 * inside it. That it never looks inside is the part this file has to honour —
 * nothing on the other side parses this, validates it, or would notice if its
 * shape changed tomorrow, so every guarantee about what comes back has to be
 * made here.
 *
 * ## What was actually wrong
 *
 * The drill-down lived in a `useState(null)` in `chooser.tsx` and nowhere else,
 * so every reload put the reader back at the project list. It looked like the
 * canvas forgetting its epic, which it was not: the host persists the epic in
 * its own table and hands it back correctly. What was lost was one level down —
 * which project the reader had opened — and the two are easy to confuse from
 * the outside because the symptom is the same sentence, "it did not remember
 * where I was".
 *
 * ## The third state is the whole difficulty
 *
 * `Chosen | null` has three values and `null` is not an absence: it means the
 * reader has not navigated at all, and so the host's standing decides where the
 * list opens. Somebody who pressed Home is at the project list even while the
 * host says they are standing inside a project; somebody who pressed nothing is
 * wherever the host says. See the essay on `Chosen` in `chooser.ts`.
 *
 * Writing `null` as "nothing kept" would collapse those two, and it would
 * collapse them in the direction that undoes the fix — a reader who pressed
 * Home, reloaded, and was dropped back into the project they had just left.
 * So `null` is written explicitly, as `{ v, at: 'unset' }`, and the absence of
 * a string is the only thing that means "nothing kept".
 *
 * A project name is `string | null` for the same reason it is there: `null` is
 * the group of epics the host filed under nothing, an actual project, not a
 * missing one. It survives the round trip as JSON `null`, which JSON can say.
 */

/** The shape written today. Bumped when the fields change, never reused. */
const VERSION = 1

/**
 * The string to hand the host.
 *
 * Short field names because the protocol bounds this at four kilobytes and,
 * more to the point, because somebody reading the host's database should be
 * able to see at a glance that this is a breadcrumb and not a document.
 *
 * The project name is clipped rather than refused. A name is not an identifier
 * here — it is looked up against the current answer and falls back to the
 * project list when it does not match — so a clipped name simply fails to
 * match, which is a state the page is already correct in. Refusing to save at
 * all would mean one absurd project name made this app unable to remember
 * anything.
 */
export function writing(chosen: Chosen | null): string {
  if (chosen === null) return JSON.stringify({ v: VERSION, at: 'unset' })
  if (chosen.at === 'projects') return JSON.stringify({ v: VERSION, at: 'projects' })
  return JSON.stringify({
    v: VERSION,
    at: 'epics',
    p: chosen.project.name === null ? null : chosen.project.name.slice(0, 200),
  })
}

/**
 * What the host handed back, as far as it can be believed.
 *
 * `undefined` for anything this app cannot use — no string, not JSON, a version
 * it no longer writes, an `at` naming a level that does not exist. That is
 * distinct from the `null` this returns for a remembered "not navigated yet",
 * and the distinction is the point: `undefined` means nothing was kept and the
 * caller should not touch its state at all, `null` means the reader really was
 * at the unset position and it should be restored.
 *
 * Never throws. The string was written by this app, on an older version of
 * itself, possibly months ago, possibly on another machine — it is exactly as
 * trustworthy as anything else arriving over the wire, and a remembered place
 * that half-applies is worse than one that was forgotten, because the second is
 * a fresh start and the first is a page in a state no code path meant to make.
 */
export function reading(state: string | null | undefined): Chosen | null | undefined {
  if (typeof state !== 'string' || state === '') return undefined
  let raw: unknown
  try {
    raw = JSON.parse(state)
  } catch {
    /* Not a surprise and not worth reporting. A host may hand back something
       written by a version of this app that predates this file, or by a
       hand-edited database. Either way the answer is the same. */
    return undefined
  }
  if (typeof raw !== 'object' || raw === null) return undefined
  const held = raw as Record<string, unknown>
  if (held.v !== VERSION) return undefined

  if (held.at === 'unset') return null
  if (held.at === 'projects') return { at: 'projects' }
  if (held.at === 'epics') {
    const name = held.p
    if (name === null) return { at: 'epics', project: { name: null } }
    if (typeof name === 'string') return { at: 'epics', project: { name: name.slice(0, 200) } }
    /* An `epics` place with no usable project name is not a place. Falling back
       to the project list rather than to the unfiled group, because guessing
       would put the reader somewhere they never chose. */
    return { at: 'projects' }
  }
  return undefined
}
