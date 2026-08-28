import { describe, expect, test } from 'bun:test'
import { UNDESCRIBED_PROJECT, choosingDoes, openEpic, placeShown } from '../atlas/chooser.ts'
import type { Project } from '../atlas/grouping.ts'
import { intoProjects } from '../atlas/grouping.ts'
import type { Epic } from '../atlas/reading.ts'
import { words } from '../atlas/situation.ts'

/**
 * The state machine behind the drill-down a narrow pane gets instead of a map.
 *
 * All of it is here rather than in the component for the same reason
 * `situation.ts` holds its sentences as data: the interesting claims are about
 * which screen a reader lands on, what is marked for them, and what is said when
 * nothing can be pressed — and all three are invisible from inside JSX. What is
 * NOT here is the layout — whether the rows fit a 220-pixel pane, whether the
 * breadcrumb wraps rather than pushing the page sideways — because that is a
 * claim about pixels and happy-dom answers zero to every measurement. It lives
 * in a Playwright probe.
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

/** Which screen a `Place` is, said as one value so a test can assert on it. */
function at(place: ReturnType<typeof placeShown>): string | null {
  return place.at === 'projects' ? 'projects' : place.project.name
}

describe('which of the two screens the drill-down is on', () => {
  test('with no host standing and nothing pressed, it opens on the projects', () => {
    /*
     * The list, not the first project's epics. Opening inside a project nobody
     * named would be this form choosing on the reader's behalf and then writing
     * that choice into the breadcrumb, which is the one place on screen
     * reserved for saying where somebody is.
     */
    expect(at(placeShown(intoProjects(EPICS), null))).toBe('projects')
  })

  test('with a host standing, it opens inside the project the host named', () => {
    const territory = intoProjects(EPICS, { epic: null, project: 'Courier' })
    expect(at(placeShown(territory, null))).toBe('Courier')
  })

  test('pressing Home wins over what the host says, and does not bounce back', () => {
    /*
     * The whole reason "has not navigated" is a third state rather than the
     * same value as "is at the projects": with the two collapsed, the back
     * button in a framed pane would put the reader on the project list and the
     * next render would send them straight into the project they just left.
     */
    const territory = intoProjects(EPICS, { epic: null, project: 'Courier' })
    expect(at(placeShown(territory, { at: 'projects' }))).toBe('projects')
  })

  test('drilling in scopes the list to the project that was pressed', () => {
    const territory = intoProjects(EPICS, { epic: null, project: 'Courier' })
    const place = placeShown(territory, { at: 'epics', project: { name: 'Roadmap' } })
    expect(at(place)).toBe('Roadmap')
    expect(place.at === 'epics' && place.project.epics.map((e) => e.slug)).toEqual([
      'off-means-off',
      'a-green-gate',
    ])
  })

  test('the group of epics filed under nothing is a project the reader can drill into', () => {
    /*
     * The pick is an object rather than a bare `string | null` precisely so
     * this case exists: `null` here means "the group with no name", and it must
     * not be read as "the reader has picked nothing" and quietly replaced by
     * the project list.
     */
    const place = placeShown(intoProjects(EPICS), { at: 'epics', project: { name: null } })
    expect(at(place)).toBeNull()
    expect(place.at === 'epics' && place.project.epics.map((e) => e.slug)).toEqual(['unfiled'])
  })

  test('a project this answer no longer names sends the reader to the list, not to a neighbour', () => {
    /*
     * Reachable: the reader drills into a project, presses "ask again", and the
     * new answer no longer names it. Falling back to a neighbour — which the
     * two selects did, because a select must display something — would leave
     * the breadcrumb reading `Home / Courier` for a reader who chose Roadmap.
     */
    const territory = intoProjects(EPICS, { epic: null, project: 'Courier' })
    const place = placeShown(territory, {
      at: 'epics',
      project: { name: 'A Project That Went Away' },
    })
    expect(at(place)).toBe('projects')
  })

  test('the project is found by name rather than by position', () => {
    /*
     * A second answer may name the same projects in a different order, and an
     * index held across that would re-point the list at a different project
     * while the breadcrumb went on reading the same word.
     */
    const reordered = intoProjects([EPICS[2]!, EPICS[0]!, EPICS[1]!])
    expect(at(placeShown(reordered, { at: 'epics', project: { name: 'Roadmap' } }))).toBe('Roadmap')
  })
})

describe('which epic the form marks, and which it does not', () => {
  const territory = intoProjects(EPICS, { epic: 'the-lone-one', project: 'Courier' })
  const of = (name: string | null): Project =>
    territory.projects.find((project) => project.name === name)!

  test('nothing is marked for the reader', () => {
    /*
     * The rule this file exists to protect. Choosing an epic here asks the host
     * to MOVE, so a row that arrived already marked would be claiming the
     * reader is somewhere they are not.
     */
    expect(openEpic(of('Roadmap'), territory.reading)).toBeNull()
  })

  test('except the one the host itself reports as open', () => {
    expect(openEpic(of('Courier'), territory.reading)?.slug).toBe('the-lone-one')
  })

  test('and that mark does not travel into a project it does not belong to', () => {
    expect(openEpic(of('Roadmap'), 'the-lone-one')).toBeNull()
  })

  test('a host that named no open epic marks nothing at all', () => {
    const plain = intoProjects(EPICS)
    expect(plain.reading).toBeNull()
    for (const project of plain.projects) expect(openEpic(project, plain.reading)).toBeNull()
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
  test('it is a project, and the drill-down opens on it', () => {
    const territory = intoProjects(EPICS, { epic: null, project: 'A Project Nothing Describes' })
    const place = placeShown(territory, null)
    expect(at(place)).toBe('A Project Nothing Describes')
    expect(place.at === 'epics' && place.project.onlyFromContext).toBe(true)
    expect(place.at === 'epics' && place.project.epics.length).toBe(0)
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
