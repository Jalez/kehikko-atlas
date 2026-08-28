import type { Project, Territory } from './grouping.ts'
import type { Epic } from './reading.ts'
import type { Words } from './situation.ts'

/**
 * What the compact form is showing, and what it says when there is nothing to
 * show — the arithmetic behind the drill-down, kept out of the component.
 *
 * ## Why there is a compact form at all
 *
 * Below about three hundred pixels the card grid is not a broken map, it is the
 * wrong map. That is a stronger claim than "it is cramped", and it is worth
 * saying exactly what it rests on, because the obvious response to a narrow pane
 * — shrink the cards, drop a column, tighten the padding — was already made in
 * full and is not what this replaces.
 *
 * A card is a comparison device. It exists so a reader can hold four or five
 * epics side by side and pick one, and it earns its three-part shape — a title,
 * a lede, a slug — from being read against its neighbours. At 220 pixels there
 * are no neighbours: one card per row, four cards in a 600-pixel pane, and the
 * whole answer is fifteen screens of scrolling. Every part of the card is still
 * legible; the thing the cards were arranged to let you do is gone. Measured at
 * that width, the lede is 32 characters to the line, two thirds of the slugs are
 * shortened to an ellipsis, and the project headings — name, count, "you are
 * here" — stack onto two lines. None of that is fatal on its own. Together they
 * describe a page nobody browses; they scroll it looking for a name they already
 * know.
 *
 * So the compact form gives up browsing and keeps travel, which is what Atlas is
 * FOR. It is not a summary, not a collapsed tree and not a card grid with the
 * cards taken out; it is a different answer to a different question.
 *
 * ## It was two selects, and now it is a drill-down
 *
 * The first build of this was a pair of shadcn selects — a project, then an epic
 * inside it — and the argument for them was sound as far as it went: a select is
 * the smallest control that answers "take me to the one I am thinking of", its
 * list is drawn OVER the page rather than in it, so it is as usable at 220
 * pixels as at 900, and it costs one gesture more than a card and several
 * screens less. None of that turned out to be wrong. What was wrong was how much
 * page was left standing around them.
 *
 * Two selects need two labels, two triggers each displaying a value, a sentence
 * saying what choosing does, and — because a trigger can only show a title — a
 * panel underneath repeating the chosen epic's title, lede, slug and size, since
 * otherwise choosing one told the reader nothing about what they had chosen.
 * Measured in a 220-pixel frame that came to 247 characters of standing text
 * before the reader had touched anything, in a pane that is often three hundred
 * pixels tall. The verdict on it was "still too noisy", and the noise was not
 * any one of those parts: it is that a select shows one value and hides its
 * list, so everything the list would have said has to be re-said in prose
 * around it.
 *
 * A drill-down inverts that. The list IS the page — one level of it at a time —
 * so a row needs no label, no trigger, no value echoed back to it, and no panel
 * underneath explaining what the trigger is currently displaying. Two screens,
 * each a column of names: the projects, and then the epics of one project. What
 * a reader gives up is seeing both levels at once, which at this width was never
 * on offer anyway — a select shows one level and a closed list.
 *
 * The one thing the selects had that a drill-down must replace on purpose is the
 * ability to change your mind about the project without leaving the epic list,
 * which a select gave away free by being permanently on screen. Hence the
 * breadcrumb AND the back button below it: the crumb says where you are, the
 * button is the way out, and they are not redundant for leading to the same
 * place — at this width the crumb is small type that reads as a caption, and a
 * caption is a poor thing to ask somebody to aim at.
 *
 * ## Nothing is chosen for the reader
 *
 * The rule the selects were built around survives, and matters more here.
 * Choosing an epic ASKS THE HOST TO MOVE. So no row is marked because the reader
 * pressed it; the only epic this form marks is the one the host itself reports
 * as open, and that one is a fact rather than a guess. `openEpic` is the whole of
 * it, and it will not fall back to the first epic in a project. It is the same
 * rule `epic-card.tsx` states for the wide map — a card never moves its own
 * marker; it asks, and `roadmap.context` says where anybody actually ended up.
 *
 * Which LEVEL the form opens on is a different question, because moving between
 * levels asks nobody anything. It opens inside the project the host says the
 * reader is standing in, and on the project list when the host named none:
 * a gesture saved where there is a fact to start from, and nothing claimed where
 * there is not. See `placeShown`.
 */

/**
 * A project the reader picked, by the only name it has.
 *
 * Wrapped in an object rather than passed as a bare `string | null`, because
 * `null` is a project — the group of epics the host filed under nothing — and
 * "the group with no name" and "the reader has picked nothing" would otherwise
 * be the same value. That is the same conflation this whole app exists to avoid,
 * one level down and in a variable rather than on a screen.
 */
export interface Picked {
  name: string | null
}

/**
 * Where the reader has navigated to, by their own hand.
 *
 * `null` is a third state rather than a missing one: it means the reader has not
 * navigated at all yet, which is not the same as having pressed Home. Somebody
 * who pressed Home is at the project list even though the host says they are
 * standing in a project; somebody who has pressed nothing is wherever the host
 * says they are standing. Collapsing the two would make the back button throw a
 * reader straight back into the project they had just left.
 */
export type Chosen = { at: 'projects' } | { at: 'epics'; project: Picked }

/**
 * Which of the two levels is drawn, with the project resolved against the answer
 * currently on screen.
 *
 * Resolved rather than carried, because the question can be asked again —
 * `again()` exists — and the project a reader drilled into may not be in the new
 * answer.
 */
export type Place = { at: 'projects' } | { at: 'epics'; project: Project }

/**
 * Where the drill-down is.
 *
 * The project is looked up by name rather than held by position, because a
 * second answer may name the same projects in a different order, and an index
 * kept across that would silently re-point the list at a different project while
 * the breadcrumb went on reading the same word.
 *
 * A drilled-into project the current answer no longer names falls back to the
 * PROJECT LIST — not to a neighbour, and not to wherever the host says the
 * reader is standing. That is a change from the two selects, which fell back to
 * the standing project, and the breadcrumb is the reason: a select showing a
 * project the reader did not pick is a control with a surprising value in it,
 * but a crumb reading `Home / Courier` when the reader drilled into Roadmap is
 * this page stating, in the one place on screen reserved for saying where you
 * are, something that is not true. The project list is the one screen that
 * cannot be wrong about that.
 */
export function placeShown(territory: Territory, chosen: Chosen | null): Place {
  if (chosen === null) {
    /*
     * No navigation yet, so the host's standing decides. Opening inside the
     * project the host says the reader is in saves a gesture and claims nothing
     * — drilling in asks nobody anything, it only scopes a list — and it is the
     * level the "open" marker lives on, which is the one fact about this reader
     * the host went out of its way to give this app.
     */
    const here = territory.projects.find(
      (project) => project.name !== null && project.name === territory.here,
    )
    return here ? { at: 'epics', project: here } : { at: 'projects' }
  }
  if (chosen.at === 'projects') return { at: 'projects' }
  const project = territory.projects.find((each) => each.name === chosen.project.name)
  return project ? { at: 'epics', project } : { at: 'projects' }
}

/**
 * The epic in this project that the host says is open, if it named one of these.
 *
 * `reading` is the slug the host reported as open, already matched against this
 * answer by `intoProjects` — so it is a fact rather than a hope. It is the only
 * thing allowed to mark a row unasked, and the mark does not travel: an epic
 * open in Courier marks nothing while the reader is looking at Roadmap, because
 * the marker means "this is the one you are looking at" and that is false of
 * every row in a project the reader is not in.
 */
export function openEpic(project: Project, reading: string | null): Epic | null {
  if (reading === null) return null
  return project.epics.find((epic) => epic.slug === reading) ?? null
}

/**
 * The one way a project on this map can hold no epics.
 *
 * A project exists because an epic named it, so an empty project is only ever
 * the case `intoProjects` builds on purpose: the host said the reader is
 * standing somewhere its own answer never mentioned. The compact form and the
 * wide one both draw this, and they draw the same string — a sentence that
 * drifted between the two would be two different accounts of one fact.
 *
 * It is deliberately NOT the `none` situation's words. "The host named no epics
 * at all" and "the host named none in this project" are different facts, and
 * the second is the one that comes with a project name attached.
 */
export const UNDESCRIBED_PROJECT: Words = {
  headline: 'The host named this project and described none of its epics.',
  body:
    'The host says the reader is in this project, and the answer it gave named no epics belonging to it. That is not an empty project — it is a project this app has been told about in one breath and not described in the other.',
}

/**
 * What choosing an epic will do, in a sentence, under the list that does it.
 *
 * Three sentences and never none, because a list whose whole purpose is to move
 * somebody must say whether it can. A row that silently does nothing is the
 * compact form's version of the dead button `epic-card.tsx` refuses to draw.
 *
 * It came through the move from selects to a drill-down unchanged, and that was
 * not inertia: the drill-down has the same problem in a sharper form, because a
 * row of names looks more pressable than a closed select does, and there are a
 * dozen of them on screen at once rather than one.
 *
 * The host's own reason wins where there is one — it knows things this app does
 * not — and the fallback is for the plainest case of all, which is that this
 * page was opened on its own and there is nobody on the other end of it.
 */
export function choosingDoes(canAsk: boolean, cannotBecause: string | null): string {
  if (canAsk) return 'Choosing one asks the host to show it.'
  if (cannotBecause) return cannotBecause
  return 'Nothing is framing this page, so there is nobody to ask to move. Choosing one shows what this app was told about it and no more.'
}
