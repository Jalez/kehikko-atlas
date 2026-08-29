import { describe, expect, test } from 'bun:test'
import type { Chosen } from '../atlas/chooser.ts'
import { intoProjects } from '../atlas/grouping.ts'
import type { Travel } from '../atlas/navigation.ts'
import type { Epic } from '../atlas/reading.ts'
import {
  epicLabel,
  epicPrompt,
  openEpicValue,
  pickedProject,
  projectLabel,
  projectNamed,
  projectValue,
  stripNews,
} from '../atlas/strip.ts'

/**
 * The arithmetic behind the short form: two pickers, one held pick, and an
 * encoding that has to survive a project name a host chose.
 *
 * What is NOT here is which layout a pane gets, and that is deliberate rather
 * than an omission. The three-way choice is made by CSS — a media query for the
 * height and a container query for the width — precisely so that it does not
 * depend on JavaScript having measured anything, and a TypeScript copy of those
 * thresholds would be a second answer to the question, testable and wrong the
 * first time somebody edited only the stylesheet. The heights and widths are
 * asserted in a browser, against a real pane, in a Playwright probe.
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

const TERRITORY = intoProjects(EPICS)
const roadmap = TERRITORY.projects.find((p) => p.name === 'Roadmap')!
const unfiled = TERRITORY.projects.find((p) => p.name === null)!

describe('a project name as a value a select can carry', () => {
  test('a named project round-trips', () => {
    expect(projectNamed(projectValue('Roadmap'))).toBe('Roadmap')
  })

  test('the unfiled group round-trips as null, which is a project and not an absence', () => {
    /*
     * The distinction this whole app is built on, one level down and inside a
     * control. "The group of epics the host filed under nothing" and "the
     * reader has picked no project" are different states and the strip draws
     * different things for them.
     */
    expect(projectNamed(projectValue(null))).toBe(null)
  })

  test('a project named like the unfiled sentinel does not collide with it', () => {
    /*
     * The case a scheme without a prefix gets wrong. `u:` is the unfiled
     * group's value; a project actually called `u:` becomes `p:u:`, and the two
     * read back as two different things.
     */
    expect(projectValue('u:')).not.toBe(projectValue(null))
    expect(projectNamed(projectValue('u:'))).toBe('u:')
    expect(projectNamed(projectValue(null))).toBe(null)
  })

  test('a project named the empty string survives, where a bare value would clear the control', () => {
    // Radix reads `''` as an instruction to clear. The prefix means no project
    // can ever produce it.
    expect(projectValue('')).not.toBe('')
    expect(projectNamed(projectValue(''))).toBe('')
  })

  test('a value this app did not write is refused rather than guessed at', () => {
    expect(projectNamed('')).toBeUndefined()
    expect(projectNamed('Roadmap')).toBeUndefined()
    expect(projectNamed('x:Roadmap')).toBeUndefined()
  })

  test('a name with the prefix inside it comes back whole', () => {
    expect(projectNamed(projectValue('a p: in the middle'))).toBe('a p: in the middle')
  })
})

describe('which project the first picker is showing', () => {
  test('nothing, when the reader is at the top of the trail', () => {
    expect(pickedProject(TERRITORY, { at: 'projects' })).toBe(null)
  })

  test('the one the reader picked', () => {
    const chosen: Chosen = { at: 'epics', project: { name: 'Courier' } }
    expect(pickedProject(TERRITORY, chosen)?.name).toBe('Courier')
  })

  test('the unfiled group is pickable like any other', () => {
    expect(pickedProject(TERRITORY, { at: 'epics', project: { name: null } })?.name).toBe(null)
  })

  test('with no navigation at all, the host’s standing decides', () => {
    /*
     * `null` is the third value and not an absence: it means the reader has not
     * navigated, so the strip opens where the host says they are standing. The
     * same rule the drill-down follows, from the same function, so the two
     * forms cannot open on different projects from one state.
     */
    const standing = intoProjects(EPICS, { epic: null, project: 'Courier' })
    expect(pickedProject(standing, null)?.name).toBe('Courier')
    expect(pickedProject(TERRITORY, null)).toBe(null)
  })

  test('a picked project the answer no longer names falls back to no pick', () => {
    const chosen: Chosen = { at: 'epics', project: { name: 'Gone' } }
    expect(pickedProject(TERRITORY, chosen)).toBe(null)
  })
})

describe('the epic picker holds a fact, never a pick', () => {
  test('its value is the epic the host says is open', () => {
    expect(openEpicValue(roadmap, 'off-means-off')).toBe('off-means-off')
  })

  test('undefined where the host names none, so the control reads as unset', () => {
    /*
     * Not `''`. Radix reads the empty string as an instruction to clear and
     * `undefined` as no value, and only the second draws the placeholder.
     */
    expect(openEpicValue(roadmap, null)).toBeUndefined()
  })

  test('an epic open in another project marks nothing here', () => {
    // The marker means "this is the one you are looking at", which is false of
    // every row in a project the reader is not in.
    expect(openEpicValue(roadmap, 'the-lone-one')).toBeUndefined()
  })

  test('no project picked is no value, not the first epic of anything', () => {
    expect(openEpicValue(null, 'off-means-off')).toBeUndefined()
  })
})

describe('what the pickers are called', () => {
  test('an epic with no title is named by its slug, never "Untitled"', () => {
    expect(epicLabel(epic('a-slug', 'Roadmap', null))).toBe('a-slug')
  })

  test('a project with no name is not given one', () => {
    expect(projectLabel(unfiled)).toBe('no project named')
    expect(projectLabel(roadmap)).toBe('Roadmap')
  })

  test('the three things the epic picker can be holding nothing for are three sentences', () => {
    const said = [
      epicPrompt(null),
      epicPrompt({ name: 'Empty', epics: [], onlyFromContext: true }),
      epicPrompt(roadmap),
    ]
    expect(new Set(said).size).toBe(3)
    expect(said[0]).toContain('project')
  })
})

describe('the line under the pickers, which is usually not there at all', () => {
  const travel = (outcome: Travel['outcome'], why = ''): Travel =>
    ({ outcome, why, epic: null }) as Travel

  test('nothing attempted, nothing drawn', () => {
    /*
     * The short form's one departure from the drill-down's rule that a list
     * which moves somebody must always say so. The sentence costs a sixth of a
     * 120-pixel pane to say the same thing on every visit, so it moves to the
     * `title` and the `aria-label` of the controls themselves; what the rule
     * protects — that nobody presses something which silently does nothing — is
     * kept by the items being inert text when there is nobody to ask. The
     * argument is on `stripNews`.
     */
    expect(stripNews(null)).toBe(null)
  })

  test('what the host said about an attempt does earn the line', () => {
    // News, rather than instructions: the answer to a question the reader just
    // asked by pressing something.
    expect(stripNews(travel('declined', 'the reader has unsaved edits open'))).toBe(
      'the reader has unsaved edits open',
    )
  })

  test('a move says nothing, because the canvas already said it', () => {
    /*
     * `travelWords` is empty for `moved` on purpose — the reader is now looking
     * at the epic they asked for and the screen said so by changing. A line
     * confirming it would be this page narrating something visible.
     */
    expect(stripNews(travel('moved'))).toBe(null)
  })

  test('`cannot-ask` never takes the line', () => {
    /*
     * Sticky, and about the host rather than about an epic. It is already the
     * standing sentence on every control's `title`, in the host's own words,
     * and every item is inert while it holds — so drawing it here would spend
     * height on a sentence that is already twice said.
     */
    expect(stripNews(travel('cannot-ask', 'this host cannot be asked to move'))).toBe(null)
  })

  test('an outcome the host sent no words for still says something', () => {
    // A refusal must never arrive as a blank line: the reader pressed
    // something and is owed an answer, even a generic one.
    expect(stripNews(travel('no-such-target'))).not.toBe(null)
    expect(stripNews(travel('broke'))).not.toBe(null)
  })
})
