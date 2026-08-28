import type { Project, Territory } from './grouping.ts'
import type { Epic } from './reading.ts'
import type { Words } from './situation.ts'

/**
 * What the compact form is showing, and what it says when there is nothing to
 * show — the arithmetic behind two selects, kept out of the component.
 *
 * ## Why there is a compact form at all, and why it is two selects
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
 * FOR. Two selects — a project, then an epic inside it — is the smallest control
 * that answers "take me to the one I am thinking of", it is as usable at 220
 * pixels as at 900 because a select's list is drawn over the page rather than in
 * it, and it costs one gesture more than a card and several screens less.
 *
 * The thing it must not do is pretend to be a smaller map. It is not a summary,
 * not a collapsed tree and not a card grid with the cards taken out; it is a
 * different answer to a different question, and the page says so in a sentence
 * rather than leaving a reader to wonder where their epics went.
 *
 * ## Nothing is chosen for the reader
 *
 * `epicShown` will not fall back to the first epic in a project, and that is the
 * one rule in this file worth defending. Choosing an epic here ASKS THE HOST TO
 * MOVE. A select that arrived with a value already in it would be a select that
 * either moved the reader on load — which nothing in this app is allowed to do —
 * or displayed an epic the reader is not looking at as though they were. The
 * only value it starts with is the one the host itself reported as open, and
 * that one is not a guess.
 *
 * The project select is different and does fall back, because choosing a project
 * asks nobody anything: it scopes the second select and nothing else. Starting
 * it at the project the host says the reader is standing in, and otherwise at
 * the first the host named, saves a gesture and claims nothing.
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
 * Which project the compact form is scoped to.
 *
 * By name rather than by position, because the answer can be asked for again —
 * `again()` exists — and a new answer may name the same projects in a different
 * order. An index held across that would silently re-point the select at a
 * different project while the trigger went on reading the same word.
 *
 * Null only when the territory holds no projects at all, which `situationOf`
 * makes unreachable: a `mapped` situation has at least one epic, and an epic
 * always lands in a project even if that project's name is null.
 */
export function projectShown(territory: Territory, picked: Picked | null): Project | null {
  if (picked) {
    const chosen = territory.projects.find((project) => project.name === picked.name)
    if (chosen) return chosen
  }
  const here = territory.projects.find(
    (project) => project.name !== null && project.name === territory.here,
  )
  return here ?? territory.projects[0] ?? null
}

/**
 * Which epic the compact form is showing the essentials of.
 *
 * `open` is the slug the host reported as open, already matched against this
 * answer by `intoProjects` — so it is a fact rather than a hope, and it is the
 * only thing allowed to fill this in unasked. Everything else is the reader's
 * own pick, and a pick that names an epic outside the chosen project resolves to
 * nothing rather than to a neighbour: the two selects would otherwise disagree
 * with each other, which is worse than one of them being empty.
 */
export function epicShown(project: Project | null, open: string | null, picked: string | null): Epic | null {
  if (!project) return null
  if (picked !== null) return project.epics.find((epic) => epic.slug === picked) ?? null
  return project.epics.find((epic) => epic.slug === open) ?? null
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
 * What choosing an epic will do, in a sentence, under the select that does it.
 *
 * Three sentences and never none, because a select whose whole purpose is to
 * move somebody must say whether it can. A select that silently does nothing is
 * the compact form's version of the dead button `epic-card.tsx` refuses to draw,
 * and it is worse than the dead button, because a select gives no hint that it
 * was pressed at all.
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
