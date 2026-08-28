import { describe, expect, test } from 'bun:test'
import {
  UNDESCRIBED_PROJECT,
  choosingDoes,
  epicShown,
  projectShown,
} from '../atlas/chooser.ts'
import { intoProjects } from '../atlas/grouping.ts'
import type { Epic } from '../atlas/reading.ts'
import { words } from '../atlas/situation.ts'

/**
 * The arithmetic behind the two selects a narrow pane gets instead of a map.
 *
 * All of it is here rather than in the component for the same reason
 * `situation.ts` holds its sentences as data: the interesting claims are about
 * what is chosen and what is said when nothing can be, and both are invisible
 * from inside JSX. What is NOT here is the layout — whether the selects fit a
 * 220-pixel pane, whether the open list stays inside the frame — because that
 * is a claim about pixels and happy-dom answers zero to every measurement. It
 * lives in a Playwright probe.
 */

function epic(slug: string, project: string | null, title: string | null = slug): Epic {
  return { slug, title, lede: null, project, size: null, unread: [] }
}

const EPICS = [
  epic('off-means-off', 'Roadmap', 'Off means off'),
  epic('a-green-gate', 'Roadmap', 'A green gate'),
  epic('the-lone-one', 'Courier', 'The lone one'),
  epic('unfiled', null, 'Filed under nothing'),
]

describe('which project the form is scoped to', () => {
  test('the reader’s pick wins', () => {
    const territory = intoProjects(EPICS)
    expect(projectShown(territory, { name: 'Courier' })?.name).toBe('Courier')
  })

  test('the group of epics filed under nothing is a project the reader can pick', () => {
    const territory = intoProjects(EPICS)
    /*
     * The pick is an object rather than a bare `string | null` precisely so
     * this case exists: `null` here means "the group with no name", and it must
     * not be read as "the reader has picked nothing" and silently replaced by
     * the first project.
     */
    const shown = projectShown(territory, { name: null })
    expect(shown?.name).toBeNull()
    expect(shown?.epics.map((e) => e.slug)).toEqual(['unfiled'])
  })

  test('with no pick, it starts where the host says the reader is standing', () => {
    const territory = intoProjects(EPICS, { epic: null, project: 'Courier' })
    expect(projectShown(territory, null)?.name).toBe('Courier')
  })

  test('with no pick and no standing, it starts at the first project the host named', () => {
    const territory = intoProjects(EPICS)
    expect(projectShown(territory, null)?.name).toBe('Roadmap')
  })

  test('a pick naming a project this answer does not have falls back rather than showing nothing', () => {
    /*
     * Reachable: the reader picks a project, presses "ask again", and the new
     * answer no longer names it. An empty form would be this app reporting the
     * absence of a project as though it were a fact about the roadmap, when it
     * is a fact about a stale pick.
     */
    const territory = intoProjects(EPICS, { epic: null, project: 'Courier' })
    expect(projectShown(territory, { name: 'A Project That Went Away' })?.name).toBe('Courier')
  })
})

describe('which epic the form is showing', () => {
  const territory = intoProjects(EPICS, { epic: 'the-lone-one', project: 'Courier' })
  const courier = projectShown(territory, { name: 'Courier' })
  const roadmap = projectShown(territory, { name: 'Roadmap' })

  test('nothing is chosen for the reader', () => {
    /*
     * The rule this whole file exists to protect. Choosing an epic here asks
     * the host to MOVE, so a select that arrived with a value in it would
     * either move somebody on load or claim they are somewhere they are not.
     */
    expect(epicShown(roadmap, null, null)).toBeNull()
  })

  test('except the one the host itself reports as open', () => {
    expect(epicShown(courier, territory.reading, null)?.slug).toBe('the-lone-one')
  })

  test('and that one is not carried into a project it does not belong to', () => {
    expect(epicShown(roadmap, territory.reading, null)).toBeNull()
  })

  test('a pick outside the chosen project resolves to nothing, not to a neighbour', () => {
    expect(epicShown(courier, null, 'off-means-off')).toBeNull()
  })

  test('a pick inside it wins over what the host says is open', () => {
    expect(epicShown(courier, 'the-lone-one', 'the-lone-one')?.title).toBe('The lone one')
  })
})

describe('what the form says about what choosing does', () => {
  test('three different sentences, and never silence', () => {
    const canAsk = choosingDoes(true, null)
    const refused = choosingDoes(false, 'this host does not answer the navigation method')
    const alone = choosingDoes(false, null)
    for (const said of [canAsk, refused, alone]) expect(said.length).toBeGreaterThan(0)
    expect(new Set([canAsk, refused, alone]).size).toBe(3)
  })

  test('the host’s own reason is preferred over anything written here', () => {
    const host = 'the roadmap is mid-migration and moving would land the reader nowhere'
    expect(choosingDoes(false, host)).toBe(host)
  })

  test('with no host at all it says so, rather than repeating a reason it was never given', () => {
    expect(choosingDoes(false, null)).toContain('Nothing is framing this page')
  })
})

describe('a project the host named and described no epics for', () => {
  test('it is a project, and it says why it is empty', () => {
    const territory = intoProjects(EPICS, { epic: null, project: 'A Project Nothing Describes' })
    const shown = projectShown(territory, { name: 'A Project Nothing Describes' })
    expect(shown?.onlyFromContext).toBe(true)
    expect(shown?.epics.length).toBe(0)
  })

  test('its words are not the words for a host with no epics at all', () => {
    /*
     * The rule of this app, applied to the two absences a compact form can
     * reach. "The host named no epics" and "the host named none in THIS
     * project" are different facts, and a compact layout is exactly where two
     * sentences get collapsed into one to save a line.
     */
    const none = words({ kind: 'none' })
    expect(UNDESCRIBED_PROJECT.headline).not.toBe(none.headline)
    expect(UNDESCRIBED_PROJECT.body).not.toBe(none.body)
    expect(UNDESCRIBED_PROJECT.body).toContain('this project')
  })
})
