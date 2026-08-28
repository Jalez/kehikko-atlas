import { describe, expect, test } from 'bun:test'
import { intoProjects, widest } from '../atlas/grouping.ts'
import type { Epic } from '../atlas/reading.ts'

/** A readable epic, so the cases below say only what they are about. */
function epic(slug: string, project: string | null = null, size: number | null = null): Epic {
  return { slug, title: slug, lede: null, project, size, unread: [] }
}

describe('a project is a name some epics share', () => {
  test('epics naming the same project land in one group, in the order they arrived', () => {
    const { projects } = intoProjects([
      epic('a', 'Roadmap'),
      epic('b', 'Courier'),
      epic('c', 'Roadmap'),
    ])
    expect(projects.map((p) => p.name)).toEqual(['Roadmap', 'Courier'])
    expect(projects[0]?.epics.map((e) => e.slug)).toEqual(['a', 'c'])
  })

  test('order is first appearance, never alphabetical', () => {
    // The host chose an order and it is the only ordering signal there is.
    const { projects } = intoProjects([epic('a', 'Zebra'), epic('b', 'Alpha')])
    expect(projects.map((p) => p.name)).toEqual(['Zebra', 'Alpha'])
  })
})

describe('a project nothing else mentions', () => {
  const answer = [
    epic('a', 'Roadmap'),
    epic('b', 'Roadmap'),
    epic('c', 'Roadmap'),
    epic('lone', 'Courier'),
  ]

  test('one epic is enough to make a project real', () => {
    const { projects } = intoProjects(answer)
    const courier = projects.find((p) => p.name === 'Courier')
    expect(courier).toBeDefined()
    expect(courier?.epics.map((e) => e.slug)).toEqual(['lone'])
  })

  test('it is not folded into a bucket, merged, or dropped', () => {
    const { projects } = intoProjects(answer)
    expect(projects).toHaveLength(2)
    expect(projects.map((p) => p.name)).toEqual(['Roadmap', 'Courier'])
    // No invented group has appeared alongside it.
    expect(projects.some((p) => p.name === 'Other')).toBe(false)
    expect(projects.some((p) => p.name === null)).toBe(false)
  })

  test('every epic in the answer is on the map exactly once', () => {
    // The property that matters more than any arrangement: nothing is lost.
    const { projects, epics } = intoProjects(answer)
    const placed = projects.flatMap((p) => p.epics.map((e) => e.slug))
    expect(placed.sort()).toEqual(['a', 'b', 'c', 'lone'])
    expect(epics).toBe(4)
  })
})

describe('an epic naming no project', () => {
  test('goes in a group with no name, rather than being given one', () => {
    const { projects } = intoProjects([epic('a', 'Roadmap'), epic('loose', null)])
    const unfiled = projects.find((p) => p.name === null)
    expect(unfiled?.epics.map((e) => e.slug)).toEqual(['loose'])
  })

  test('that group is last, whatever order the epics arrived in', () => {
    const { projects } = intoProjects([epic('loose', null), epic('a', 'Roadmap')])
    expect(projects.at(-1)?.name).toBeNull()
    expect(projects[0]?.name).toBe('Roadmap')
  })
})

describe('project names are strings a stranger chose', () => {
  test('a project called `constructor` is an ordinary project', () => {
    const { projects } = intoProjects([epic('a', 'constructor'), epic('b', 'constructor')])
    expect(projects).toHaveLength(1)
    expect(projects[0]?.name).toBe('constructor')
    expect(projects[0]?.epics).toHaveLength(2)
  })

  test('a project called `__proto__` gets its own group and pollutes nothing', () => {
    const { projects } = intoProjects([epic('a', '__proto__'), epic('b', 'Roadmap')])
    expect(projects.map((p) => p.name)).toEqual(['__proto__', 'Roadmap'])
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  test('`toString` and `valueOf` are project names like any other', () => {
    const { projects } = intoProjects([epic('a', 'toString'), epic('b', 'valueOf')])
    expect(projects.map((p) => p.name)).toEqual(['toString', 'valueOf'])
    expect(projects.every((p) => p.epics.length === 1)).toBe(true)
  })
})

describe('where the host says the reader is standing', () => {
  test('the project from the context is marked, and is not duplicated', () => {
    const territory = intoProjects([epic('a', 'Roadmap')], { epic: null, project: 'Roadmap' })
    expect(territory.projects).toHaveLength(1)
    expect(territory.here).toBe('Roadmap')
    expect(territory.projects[0]?.onlyFromContext).toBe(false)
  })

  test('a project named only by the context appears, empty and marked as such', () => {
    const territory = intoProjects([epic('a', 'Roadmap')], { epic: null, project: 'Courier' })
    const courier = territory.projects.find((p) => p.name === 'Courier')
    expect(courier?.epics).toHaveLength(0)
    expect(courier?.onlyFromContext).toBe(true)
  })

  test('a slug that names one of these epics marks it as open', () => {
    const territory = intoProjects([epic('a', 'Roadmap'), epic('b', 'Roadmap')], {
      epic: 'b',
      project: 'Roadmap',
    })
    expect(territory.reading).toBe('b')
    expect(territory.matchedNothing).toBe(false)
  })

  test('an open epic that is not in the list marks nothing, and does not shout', () => {
    // The host's two statements disagree. Nothing is highlighted, the fact is
    // recorded for the diagnostics, and the map itself says nothing about it.
    const territory = intoProjects([epic('a', 'Roadmap')], {
      epic: 'not-in-the-list',
      project: 'Roadmap',
    })
    expect(territory.reading).toBeNull()
    expect(territory.matchedNothing).toBe(true)
  })

  test('no context at all is not a special case', () => {
    const territory = intoProjects([epic('a', 'Roadmap')])
    expect(territory.reading).toBeNull()
    expect(territory.matchedNothing).toBe(false)
    expect(territory.here).toBeNull()
  })
})

describe('an answer with nothing in it', () => {
  test('yields no projects rather than an empty one', () => {
    const territory = intoProjects([])
    expect(territory.projects).toHaveLength(0)
    expect(territory.epics).toBe(0)
    expect(widest(territory)).toBe(0)
  })

  test('except that the context can still put the reader somewhere', () => {
    const territory = intoProjects([], { epic: null, project: 'Roadmap' })
    expect(territory.projects).toHaveLength(1)
    expect(territory.projects[0]?.onlyFromContext).toBe(true)
  })
})

describe('the shape of the whole thing', () => {
  test('the widest project sets the scale for the bars', () => {
    const territory = intoProjects([
      epic('a', 'Big'),
      epic('b', 'Big'),
      epic('c', 'Big'),
      epic('d', 'Small'),
    ])
    expect(widest(territory)).toBe(3)
  })

  test('a project that exists only in the context does not set the scale', () => {
    const territory = intoProjects([epic('a', 'Big'), epic('b', 'Big')], {
      epic: null,
      project: 'Ghost',
    })
    expect(widest(territory)).toBe(2)
  })
})
