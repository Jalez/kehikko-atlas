import { type Chosen, openEpic, placeShown } from './chooser.ts'
import type { Project, Territory } from './grouping.ts'
import { type Travel, travelWords } from './navigation.ts'
import type { Epic } from './reading.ts'

/**
 * What the strip is showing: the arithmetic behind the short form, kept out of
 * the component.
 *
 * ## Why there is a third form at all
 *
 * Atlas chose its layout on WIDTH alone, and width alone cannot tell a pane
 * apart from a strip. A pane 900 pixels wide and 120 tall — a band across the
 * top of a canvas, which is a perfectly ordinary thing for somebody to drag a
 * module into — was 900 pixels wide, so it got the map. Measured there, the map
 * is 1997 pixels of document in 110 pixels of window: a scrollbar with a few
 * words behind it, and the reader's whole interaction with it is dragging that
 * scrollbar looking for a name they already know.
 *
 * The drill-down is not the answer either, and it is worth saying why rather
 * than reaching for it because it is the other thing that exists. It is a
 * COLUMN — a breadcrumb, a back button, and rows stacked down the page — and
 * `chooser.ts` argues for that shape from a pane 220 pixels wide, where down is
 * the only direction there is. Given 900 pixels of width and 120 of height the
 * argument runs backwards: down is the direction that has run out, and across
 * is the one going spare. Drawn there, the drill-down is a 900-pixel-wide row
 * carrying one project name, and four more of them below the fold.
 *
 * So the short form gives up the column and keeps the two questions the
 * drill-down asks in sequence — which project, then which epic — and asks them
 * BESIDE each other, because side by side is the only arrangement that costs
 * one row of height instead of two screens of scrolling.
 *
 * ## The two selects come back, and the bug they had does not
 *
 * `chooser.ts` describes at length how this app's first build was a pair of
 * shadcn selects and why they were replaced. Two of the three complaints there
 * are about a NARROW pane and do not survive the move to a wide one: the
 * standing prose ("247 characters before the reader had touched anything") was
 * two labels, a sentence and a panel re-stating the chosen epic's title, lede,
 * slug and size, all of which were there because a 220-pixel column had room
 * for them and nothing else to fill it with. A strip has no such room and does
 * not draw them: the whole form here is two controls and one sentence.
 *
 * The third complaint is the real one, and it is a bug rather than a matter of
 * taste: *two selects held two picks and had to clear one when the other
 * changed*. That does not apply here, and not because it was decided it would
 * not — because there is only ever one held pick.
 *
 * - The PROJECT picker's value is `chosen`, the same single piece of navigation
 *   state the drill-down holds. It is the reader's.
 * - The EPIC picker's value is not held at all. It is `openEpic` — the epic the
 *   HOST says is open, matched against the project on screen — and choosing one
 *   does not set it. Choosing asks the host to move, and the value changes if
 *   and when `roadmap.context` says the reader ended up somewhere. So there is
 *   no second pick to go stale when the first one changes; there is a fact,
 *   which is re-derived from the new project like everything else on the page.
 *
 * That is the same rule the cards and the drill-down rows already follow —
 * nothing marks itself on the strength of having been pressed — applied to a
 * control that has somewhere to put a value. It costs nothing extra and it is
 * what makes a select safe to use here.
 */

/**
 * The project the first picker is showing, or null when the reader is at the
 * top of the trail and has picked none.
 *
 * `placeShown` and nothing else, so the strip and the drill-down cannot open on
 * different projects from the same state — including the part that is easy to
 * get wrong, which is that `chosen === null` means the HOST's standing decides
 * rather than that nothing is picked.
 */
export function pickedProject(territory: Territory, chosen: Chosen | null): Project | null {
  const place = placeShown(territory, chosen)
  return place.at === 'epics' ? place.project : null
}

/**
 * A project name as a value a `<Select>` can carry.
 *
 * Two things a project name is that a select value may not be. It can be
 * `null` — the group of epics the host filed under nothing is a project, and
 * the distinction between it and "no project picked" is one this whole app
 * exists to keep — and Radix reserves the empty string to mean "cleared", so a
 * project named `''` would clear the control rather than fill it.
 *
 * Hence a prefix rather than the bare name. `p:` and the name for a project
 * that has one, `u:` for the unfiled group, and no name can produce `u:`
 * because every named project's value starts with `p:`. A host that names a
 * project `u:` gets `p:u:` and round-trips correctly, which is the case a
 * scheme without the prefix would have got wrong.
 */
export function projectValue(name: string | null): string {
  return name === null ? UNFILED : `p:${name}`
}

/** The value the unfiled group carries. Never produced by a named project. */
const UNFILED = 'u:'

/**
 * The name a value came from.
 *
 * `undefined` for anything this function did not write, which a select should
 * never hand back and which would otherwise be indistinguishable from the
 * unfiled group. Nothing on the other side of this is a wire, but the same rule
 * applies as everywhere else here: a value that half-parses puts the page in a
 * state no code path meant to make.
 */
export function projectNamed(value: string): string | null | undefined {
  if (value === UNFILED) return null
  if (value.startsWith('p:')) return value.slice(2)
  return undefined
}

/**
 * The epic picker's value: the one the host says is open, if it is in the
 * project on screen.
 *
 * `undefined` rather than `''` when there is none, because Radix reads the
 * empty string as an instruction to clear and `undefined` as "no value", and
 * the second is what an uncontrolled-looking placeholder needs.
 *
 * This is the whole of why a select is safe here. It is not a memory of what
 * the reader picked — pressing does not write it — it is the same fact the wide
 * map draws as a badge and the drill-down draws as a ring, in the one place
 * this form has to put it.
 */
export function openEpicValue(project: Project | null, reading: string | null): string | undefined {
  if (project === null) return undefined
  return openEpic(project, reading)?.slug ?? undefined
}

/**
 * What to call an epic in a list of them.
 *
 * The slug where the host sent no title, for the reason `chooser.ts` gives: the
 * host did not say untitled, it said nothing, and the slug is then the only
 * name the thing has. Never "Untitled" and never a dash.
 */
export function epicLabel(epic: Epic): string {
  return epic.title ?? epic.slug
}

/**
 * What to call a project in a picker.
 *
 * The same words the drill-down's rows use, from the same reasoning: a project
 * with no name is not given one, and "no project named" is the short form of
 * the wide map's "Filed under no project". Kept here rather than imported from
 * the component so the two forms cannot drift into two different phrasings of
 * one fact.
 */
export function projectLabel(project: Project): string {
  return project.name ?? 'no project named'
}

/**
 * What the epic picker says when it is holding nothing, and why.
 *
 * Three states and three sentences, because they are three different facts and
 * a placeholder reading "Epic" for all of them would be this form declining to
 * say which one it is in. They are short because they sit inside a control
 * roughly 150 pixels wide at the narrowest shape this form is drawn at.
 *
 * - No project picked: the picker is not empty, it is not yet asked a question.
 * - A project with no epics: this is the one empty project there can be — the
 *   host named it in its context and described nothing in it. `chooser.ts`
 *   holds the long version, which the drill-down has room to draw and this
 *   form does not.
 * - Otherwise: there are epics and the host says none of them is open, which is
 *   an ordinary state rather than a problem.
 */
export function epicPrompt(project: Project | null): string {
  if (project === null) return 'Pick a project first'
  if (project.epics.length === 0) return 'None described here'
  return 'Pick an epic'
}

/**
 * The only prose the strip spends height on, and usually there is none.
 *
 * ## Why the standing sentence is not drawn here
 *
 * `chooser.ts` states a rule for the drill-down and argues it well: a list whose
 * whole purpose is to move somebody must SAY whether it can, in one of three
 * sentences and never none, because a row that silently does nothing is worse
 * than a disabled control. The short form breaks that rule on purpose, and this
 * is where the reason belongs.
 *
 * The sentence costs 20 pixels of a pane that has 120. That is a sixth of the
 * budget, permanently, for a line that says the same thing on every visit and
 * is read once — measured against a strip whose entire content is one row of
 * projects and one row of epics, it is the difference between five epics
 * visible and three. The drill-down can afford it because it is a column in a
 * pane 600 pixels tall; the strip cannot, and pretending otherwise means
 * quietly spending the reader's height on prose they have already read.
 *
 * What the rule is actually protecting is not the sentence, it is the reader's
 * ability to find out. So the short form keeps the protection and drops the
 * pixels:
 *
 * - Where travel is impossible the items are not buttons at all — they are
 *   inert text, exactly as `epic-card.tsx` requires — so there is no affordance
 *   to be false. That is the failure the rule exists to prevent, and it is
 *   prevented structurally rather than by a caption.
 * - The standing sentence rides on `title` and `aria-label` instead of on a
 *   line of its own, so it is one hover or one screen reader away and costs no
 *   height at all.
 * - And what the host said about an ATTEMPT is still drawn, in full, because
 *   that is news rather than instructions — see below.
 *
 * ## What still earns its pixels
 *
 * This returns a line only when the host has answered an actual attempt with
 * something worth reading, which is the one case where prose is the answer to a
 * question the reader has just asked by pressing something. Null the rest of the
 * time, and the strip draws no element at all — not an empty one, which would
 * hold its line-height open for a sentence that is not there.
 *
 * Three outcomes never take the line:
 *
 * - `moved` — the canvas has changed under the reader, and a sentence
 *   confirming it would be this page narrating something visible.
 * - `cannot-ask` — sticky, and about the host rather than about an epic. It is
 *   already the standing sentence, on the `title`, in the host's own words, and
 *   every item is inert while it holds.
 * - nothing attempted yet — there is no news, and the standing sentence is on
 *   the `title`.
 */
export function stripNews(lastTravel: Travel | null): string | null {
  if (lastTravel === null || lastTravel.outcome === 'cannot-ask') return null
  return travelWords(lastTravel) || null
}
