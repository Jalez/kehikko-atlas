import type { Epic } from './reading.ts'

/**
 * Epics into projects.
 *
 * The whole of this app's arrangement is one decision: a project is not a thing
 * the host hands over, it is A NAME SOME EPICS SHARE. The list method gives a
 * flat list where each entry may name a project; there is no `projects.list` in
 * the protocol's `METHODS` and this app must not pretend there is one. So every
 * project on screen is a project because at least one epic said so — or, in
 * exactly one case described below, because the host said the reader is
 * standing in it.
 *
 * ## A project nothing else mentions
 *
 * The interesting case, and the one this file exists to get right. If fourteen
 * epics say "Roadmap" and one says "Courier", then "Courier" is a project with
 * one epic in it. It is not noise, not a typo to be folded into its nearest
 * neighbour, and not a candidate for an "other" bucket. Three reasons, in
 * increasing order of how much they matter:
 *
 * - This app has no way to tell a one-epic project from a fifteen-epic one that
 *   is about to grow. Every project was a one-epic project once.
 * - Folding it away would mean the map is a lossy rendering of the answer: a
 *   person could read the whole page and never learn that the host named a
 *   project called Courier. A map that omits the small territories is not a
 *   smaller map, it is a wrong one.
 * - There is no threshold that could be drawn honestly. "Projects with fewer
 *   than N epics are merged" is a rule with an N nobody can justify, and the day
 *   somebody's whole quarter is a two-epic project it hides their work.
 *
 * So: one epic naming a project is enough to make the project real, it gets its
 * own heading exactly like every other, and the page marks it as holding one
 * epic rather than hiding that.
 *
 * ## An epic naming no project
 *
 * Different case, same principle. `project` is nullable in the protocol's
 * context and a host may well have epics filed under nothing. Those do NOT get
 * invented a project name — there is no "Uncategorised" project on any host —
 * they go in a group whose name is `null`, which the page draws with a sentence
 * rather than a title. The group is last, because it is the one group whose
 * membership is defined by absence, and a reader scanning project names should
 * reach the real ones first.
 */

export interface Project {
  /** The name every epic in it shares. Null is the group of epics filed under none. */
  name: string | null
  epics: Epic[]
  /**
   * True when this project is on the map only because the host said the reader
   * is in it, and no epic in the answer named it. See `intoProjects`.
   */
  onlyFromContext: boolean
}

export interface Territory {
  projects: Project[]
  /** How many epics are on the map, across every project. */
  epics: number
  /** The project the host says the reader is in, if it named one. */
  here: string | null
  /**
   * The epic the host says is open, when it turned out to be one of these.
   *
   * `roadmap.context` carries an epic slug and a project, and the protocol is
   * explicit about why those two and nothing else: they are what a host can
   * vouch for. So this is a fact about the same kind of thing this map is made
   * of, and matching it is a straightforward comparison rather than a hopeful
   * one — which it was not in the protocol version this app was started
   * against, where the context described a journey.
   */
  reading: string | null
  /**
   * True when the host named an open epic and no epic here has that slug.
   *
   * Reported in the diagnostics and NOWHERE ELSE, because it is not this app's
   * finding to shout about: a host whose list and whose context disagree has
   * something to look at, and the most likely innocent cause is a list the host
   * filtered and a context it did not. Drawing it as an error on the map would
   * put a warning in front of a reader who can do nothing with it.
   */
  matchedNothing: boolean
}

/**
 * Where the reader is standing, as much of it as this app uses.
 *
 * Deliberately not the protocol's `ModuleContext`, even though the fields line
 * up. This function is arithmetic over two nullable strings, and typing it
 * against the wire shape would mean a test for the grouping has to construct a
 * context message — and would mean that a change to `theme`, which this file
 * will never care about, is a change to this file's signature.
 */
export interface Standing {
  /** The epic the host says is open, as `roadmap.context` spells it. */
  epic: string | null
  /** The project that epic belongs to, as the host reports it. */
  project: string | null
}

/**
 * Arrange epics under the projects they name.
 *
 * Order is **first appearance**, not alphabetical. The host chose the order it
 * answered in and it is the only ordering signal there is; sorting by name would
 * throw away whatever the host meant by it — most-recent-first, by priority, by
 * anything — and replace it with an ordering this app invented. Within a
 * project, epics keep the order they arrived in for the same reason.
 *
 * The context's project is added as an EMPTY group when the host says the reader
 * is in a project that no epic in the answer named. That looks like an edge case
 * worth ignoring and is not: it is exactly the shape of a host that has just
 * created a project, and of a host whose list is filtered in a way its context
 * is not. A map that silently omitted the project the reader is standing in
 * would be wrong about the one project they can check for themselves. The
 * group is marked `onlyFromContext` so the page can say why it is empty instead
 * of drawing a project that appears to have lost its epics.
 */
export function intoProjects(epics: Epic[], standing: Standing = { epic: null, project: null }): Territory {
  /**
   * A `Map`, not an object keyed by project name. Project names come from a
   * host's answer, which means `__proto__` and `constructor` are project names a
   * host may send — and on a plain object the first of those does not create a
   * key at all while the second finds one that was already there. The protocol
   * package's `ids.ts` argues this at length for module ids; the argument is
   * about strings from a stranger's program, and a project name is one of those.
   */
  const byName = new Map<string, Project>()
  /** The null-project group is held apart so it can be appended last. */
  let unfiled: Project | null = null

  for (const epic of epics) {
    if (epic.project === null) {
      unfiled ??= { name: null, epics: [], onlyFromContext: false }
      unfiled.epics.push(epic)
      continue
    }
    let project = byName.get(epic.project)
    if (!project) {
      project = { name: epic.project, epics: [], onlyFromContext: false }
      byName.set(epic.project, project)
    }
    project.epics.push(epic)
  }

  if (standing.project !== null && !byName.has(standing.project)) {
    byName.set(standing.project, { name: standing.project, epics: [], onlyFromContext: true })
  }

  const projects = [...byName.values()]
  if (unfiled) projects.push(unfiled)

  const open = standing.epic
  const matched = open !== null && epics.some((e) => e.slug === open)

  return {
    projects,
    epics: epics.length,
    here: standing.project,
    reading: matched ? open : null,
    matchedNothing: open !== null && !matched,
  }
}

/**
 * The largest number of epics any one project holds.
 *
 * Used by the page to scale the overview bars. Separate from `intoProjects`
 * because it is a question about a territory rather than part of building one,
 * and because a caller that does not draw bars should not pay for it.
 */
export function widest(territory: Territory): number {
  return territory.projects.reduce((most, p) => Math.max(most, p.epics.length), 0)
}
