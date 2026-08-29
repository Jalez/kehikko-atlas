import { GlobalRegistrator } from '@happy-dom/global-registrator'

/**
 * What the page actually draws, standalone and against a host.
 *
 * The other test files are about decisions made off-screen. This one is about
 * the screen, and it exists because the two most important claims this app
 * makes are claims about what a reader sees:
 *
 * - with nothing on the other end, the page says nothing has told it anything,
 *   in those words, rather than showing an empty list;
 * - with a host answering, every project the host named is on the page,
 *   including the one with a single epic in it.
 *
 * Neither is checkable from the modules underneath. `words()` can be right and
 * the component can render a different string; `intoProjects` can group
 * perfectly and the section can be folded away. So this mounts the real
 * component tree and reads the text out of it.
 *
 * Registered before any React import, because `@testing-library/react` decides
 * what it is running in at import time.
 */
GlobalRegistrator.register()

const { describe, expect, test, beforeEach, afterEach } = await import('bun:test')
const { render, screen, cleanup, waitFor, act } = await import('@testing-library/react')
const { App } = await import('../page/app.tsx')
const { words } = await import('../atlas/situation.ts')
const { UNDESCRIBED_PROJECT } = await import('../atlas/chooser.ts')
const { MESSAGE, PROTOCOL } = await import('roadmap-module-protocol')

/**
 * Pretend something is framing this page.
 *
 * `window.parent === window` is how `isFramed()` decides, so a stub host is a
 * different object in `window.parent` that records what was posted at it and
 * can post back. That is the whole of the fakery — the app's own wire code is
 * the real thing, and so is React.
 */
function frameIt() {
  const sent: any[] = []
  const parent = {
    postMessage(message: unknown) {
      sent.push(message)
    },
  }
  Object.defineProperty(window, 'parent', { value: parent, configurable: true })

  /**
   * Deliver a message to the app the way the browser would.
   *
   * Inside `act`, because a host message is what makes this app change state
   * and React wants to be told that a state change is about to happen — the
   * same reason a click below is wrapped. Without it every assertion still
   * passes and the output is a wall of warnings, which is a good way to stop
   * reading test output.
   */
  const fromHost = (data: unknown) => {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data, source: parent as never }))
    })
  }

  return { sent, fromHost }
}

function unframe() {
  Object.defineProperty(window, 'parent', { value: window, configurable: true })
}

const hello = {
  type: MESSAGE.HELLO,
  protocol: PROTOCOL,
  session: 'test',
  context: { epic: null, project: null, theme: 'light' },
}

beforeEach(() => {
  unframe()
})
afterEach(() => {
  cleanup()
})

describe('with nothing on the other end', () => {
  test('it says nothing has told it anything, in exactly those words', () => {
    render(<App />)
    const said = words({ kind: 'unframed' })
    expect(screen.getByText(said.headline)).toBeDefined()
    expect(screen.getByText(said.body)).toBeDefined()
  })

  test('there is no empty list, no spinner and no "no projects"', () => {
    render(<App />)
    const text = document.body.textContent ?? ''
    expect(text).not.toContain('Loading')
    expect(text).not.toContain('No projects')
    expect(text).not.toContain('0 projects')
    // And nothing is pressable, because there is nobody to ask.
    expect(document.querySelectorAll('article').length).toBe(0)
  })

  test('it still explains what pressing a row would do, with no host to ask', () => {
    render(<App />)
    expect(screen.getByText('Why nothing here opens')).toBeDefined()
  })
})

describe('against a host that answers', () => {
  const answer = {
    epics: [
      { slug: 'off-means-off', title: 'Off means off', project: 'Roadmap', steps: 9 },
      { slug: 'a-green-gate', title: 'A green gate means something', project: 'Roadmap' },
      { slug: 'the-lone-one', title: 'The lone one', project: 'Courier', steps: 3 },
      { slug: 'unfiled', title: 'Filed under nothing' },
    ],
  }

  test('every project the host named is on the page, including one with a single epic', async () => {
    const { sent, fromHost } = frameIt()
    render(<App />)

    fromHost(hello)
    // The greeting is answered, and the question goes out.
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    expect(sent[0].type).toBe(MESSAGE.READY)

    const asked = sent.find((m) => m.type === MESSAGE.REQUEST)
    fromHost({ type: MESSAGE.RESPONSE, id: asked.id, ok: true, data: answer })

    await waitFor(() => expect(screen.getByText('Off means off')).toBeDefined())
    // The one-epic project is a heading of its own, not folded anywhere.
    expect(screen.getAllByText('Courier').length).toBeGreaterThan(0)
    expect(screen.getByText('The lone one')).toBeDefined()
    // And the epic the host filed under nothing says so rather than being given
    // an invented project name.
    expect(screen.getAllByText('Filed under no project').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('Uncategorised')
  })

  test('a size the host gave is drawn, and one it did not is not drawn as zero', async () => {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: answer,
    })

    await waitFor(() => expect(screen.getByText('9 steps')).toBeDefined())
    expect(document.body.textContent).not.toContain('0 steps')
  })

  test('the epic the host says is open is the one marked open', async () => {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost({ ...hello, context: { epic: 'the-lone-one', project: 'Courier', theme: 'light' } })
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: answer,
    })

    /*
     * Twice: once on the card and once on the compact form's row for the same
     * epic. Both trees are in the document at once — CSS hides one — so a
     * marker drawn on only one of them would be a marker that disappears when
     * the host drags a divider.
     */
    await waitFor(() => expect(screen.getAllByText('open').length).toBe(2))
    expect(screen.getAllByText('you are here').length).toBe(1)
  })

  test('rows are pressable, and pressing one asks the host to move', async () => {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: answer,
    })
    await waitFor(() => expect(screen.getByText('Off means off')).toBeDefined())

    const row = screen.getByText('Off means off').closest('button')
    expect(row).not.toBeNull()
    act(() => row!.click())

    await waitFor(() => expect(sent.filter((m) => m.type === MESSAGE.REQUEST).length).toBe(2))
    const move = sent.filter((m) => m.type === MESSAGE.REQUEST)[1]
    expect(move.params).toEqual({ epic: 'off-means-off' })
  })
})

describe('against a host that will not answer usefully', () => {
  test('a refusal says the question was refused, not that there is no work', async () => {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: false,
      reason: 'failed',
      error: 'the store is not open right now',
    })

    await waitFor(() =>
      expect(screen.getByText(words({ kind: 'refused', reason: 'failed', error: '' }).headline)),
    )
    // The host's own sentence is shown verbatim, not summarised.
    expect(screen.getByText('the store is not open right now')).toBeDefined()
    expect(document.body.textContent).not.toContain('no epics yet')
  })

  test('an answer with no list in it is unreadable, not empty', async () => {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: { total: 12 },
    })

    await waitFor(() =>
      expect(
        screen.getByText('The host answered, and Atlas could not read the answer.'),
      ).toBeDefined(),
    )
  })

  test('a host with no epics gets the one screen that means there is nothing', async () => {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: { epics: [] },
    })

    await waitFor(() =>
      expect(screen.getByText('The host answered: it has no epics yet.')).toBeDefined(),
    )
  })

  test('a goto is answered so the host does not sit through its own timeout', async () => {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    fromHost({ type: MESSAGE.GOTO, id: 'g-1', ref: 'gh#41' })
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.WENT)).toBe(true))
    const went = sent.find((m) => m.type === MESSAGE.WENT)
    expect(went).toMatchObject({ id: 'g-1', found: false })
  })
})

describe('a project with fifteen epics does not swallow the page', () => {
  test('only the first few are drawn, and the count is on the heading either way', async () => {
    const many = {
      epics: [
        ...Array.from({ length: 15 }, (_, i) => ({
          slug: `big-${i + 1}`,
          title: `Big ${i + 1}`,
          project: 'Roadmap',
        })),
        { slug: 'small-1', title: 'Small 1', project: 'Courier' },
      ],
    }
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: many,
    })

    await waitFor(() => expect(screen.getByText('Big 1')).toBeDefined())
    // Nine are folded away behind a control that says how many.
    expect(screen.getByText('Show 9 more')).toBeDefined()
    // And the small project is still reachable without scrolling past them.
    expect(screen.getByText('Small 1')).toBeDefined()
  })
})

/**
 * The rules a 220-pixel pane imposes, checked where they can be checked.
 *
 * A layout is a claim about pixels, and most of the claims in one can only be
 * settled by a browser: whether the page scrolls sideways, whether a summary is
 * tall enough to press, whether two cards fit. Those belong in a Playwright
 * probe against a real frame, and pretending otherwise here — asserting
 * `getBoundingClientRect` in happy-dom, which answers zero to everything —
 * would be the worst kind of test, one that passes because it measured nothing.
 *
 * What IS settleable without a browser is the rule underneath the layout, and it
 * is the rule the rest of this app is built on: nothing a host said is dropped
 * without a way back to it. A narrow pane forces exactly one new way to break
 * that rule — shortening a string to make it fit — so what follows is about the
 * shortening, written as an invariant over whatever the page happens to render
 * rather than as a list of the places that shorten something today. The fourth
 * such place, added next year, is covered by the same assertion.
 */
describe('in a pane too narrow for what the host said', () => {
  /**
   * Names and sentences longer than any pane holds, plus one word with no break
   * opportunity in it anywhere — which is the case that turns a long lede into a
   * page that scrolls sideways rather than into a lede that wraps.
   */
  /*
   * Under `LIMITS.PROJECT` on purpose. A name longer than the protocol's bound
   * is clipped by `reading.ts` before the page ever sees it, so an 86-character
   * project name would be testing the reader's clipping rather than the
   * layout's — and would fail here looking like a layout bug.
   */
  const PROJECT = 'A Project Whose Name Is Also Unreasonably Long And Quite Impossible To Fit'
  const long = {
    epics: [
      {
        slug: 'a-very-long-slug-that-goes-on-and-on-for-quite-a-while-indeed',
        title:
          'A deliberately enormous epic title that keeps going well past any reasonable column width',
        lede: 'Averylongunbrokenwordthatcannotbehyphenatedanywhereatall and then ordinary prose.',
        project: PROJECT,
        steps: 12,
      },
      { slug: 'no-title-here-just-a-long-slug-to-be-going-on-with', project: PROJECT },
    ],
  }

  async function mapped() {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: long,
    })
    await waitFor(() => expect(screen.getAllByText(PROJECT).length).toBeGreaterThan(0))
  }

  test('every element that shortens a string carries the whole of it in a title', async () => {
    await mapped()

    const shortened = [...document.querySelectorAll('[class~="truncate"]')]
    /*
     * The count is asserted and not only the property. An invariant over an
     * empty set is a test that passes by finding nothing, which is exactly how
     * this would go quietly wrong the day the class is spelled differently.
     */
    expect(shortened.length).toBeGreaterThan(0)

    for (const element of shortened) {
      /*
       * The `title` is looked for on the element or on any ancestor, because
       * that is where the tooltip actually comes from: the overview puts it on
       * the whole row rather than on the span, so that pointing anywhere along
       * the row — at the bar, at the count — offers the name.
       */
      const titled = element.closest('[title]')
      expect(titled).not.toBeNull()
      expect(titled!.getAttribute('title')).toBe((element.textContent ?? '').trim())
    }
  })

  test('an epic with no title never shortens the one name it has', async () => {
    await mapped()

    const only = screen.getByText('no-title-here-just-a-long-slug-to-be-going-on-with')
    /*
     * The slug IS the name when the host sent no title, so the treatment a slug
     * gets underneath a title — shortened, with the whole of it on a tooltip —
     * would leave an epic whose only name on screen is an ellipsis. It breaks
     * instead, mid-word where it has to, because a slug is an identifier rather
     * than prose and nothing is lost by breaking one anywhere.
     */
    expect(only.className).not.toContain('truncate')
    expect(only.className).toContain('break-all')
  })

  test('a host sentence with no break in it is allowed to break', async () => {
    await mapped()

    expect(screen.getByText(/^Averylongunbrokenword/).className).toContain('break-words')
    const title = screen.getByText(/^A deliberately enormous epic title/)
    expect(title.className).toContain('break-words')
    /*
     * And `min-w-0` beside it, which is not decoration. This heading sits in a
     * flex row, and a flex item's floor is its min-content width unless it is
     * told otherwise — so `break-words` alone leaves the heading refusing to be
     * narrower than its longest word, and the card, the section and the page
     * widen to accommodate one epic.
     */
    expect(title.className).toContain('min-w-0')
  })
})

describe('what decides the layout is the pane, not the window', () => {
  test('the epic grid asks its container how wide it is', async () => {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: { epics: [{ slug: 'one', title: 'One', project: 'Roadmap' }] },
    })
    await waitFor(() => expect(screen.getByText('One')).toBeDefined())

    const grid = document.querySelector('section [class*="grid-cols-1"]')
    expect(grid).not.toBeNull()
    /*
     * Container queries rather than `sm:` and `xl:`. A media query inside a
     * framed module is evaluated against the frame's viewport, which is the pane
     * — nearly right, and wrong past a thousand pixels, where the pane goes on
     * growing and this `max-w-5xl` column does not. See the essay in `app.tsx`.
     * Asserted against the class list because the alternative is asserting a
     * computed column count, and happy-dom has no layout to compute one from.
     */
    expect(grid!.className).toContain('@md/page:grid-cols-2')
    expect(grid!.className).toContain('@2xl/page:grid-cols-3')
    expect(grid!.className).not.toMatch(/(^|\s)(sm|md|lg|xl):grid-cols/)
  })

  test('the container is named, and it is not the element carrying the padding', () => {
    render(<App />)

    const container = document.querySelector('[class~="@container/page"]')
    expect(container).not.toBeNull()
    /*
     * An element cannot query itself: a `@sm/page:` written on the container
     * resolves against the container's OWN nearest ancestor container, of which
     * there is none, so the utility never applies — silently. That held the
     * page's padding at its narrowest value at every width for as long as the
     * ruler and the padded box were one element. Keeping them apart is the fix;
     * this is the assertion that keeps them apart.
     */
    expect(container!.className).not.toMatch(/@\w+\/page:/)
  })
})

/**
 * The drill-down a pane under 300 pixels gets instead of a map.
 *
 * Whether it FITS is a claim about pixels and belongs in a browser; happy-dom
 * answers zero to every measurement, and both trees are equally "visible" to it
 * because nothing here applies a stylesheet. What is settleable without one is
 * which tree exists, what is written on it, which screen of the two is drawn
 * after a press, and — the thing this app is for — that compressing the layout
 * has not compressed six different absences into one.
 */
describe('the compact form, in a pane too narrow for a map', () => {
  const answer = {
    epics: [
      {
        slug: 'off-means-off',
        title: 'Off means off',
        lede: 'A setting that is off stays off across every surface that reads it.',
        project: 'Roadmap',
        steps: 9,
      },
      { slug: 'the-lone-one', title: 'The lone one', project: 'Courier' },
    ],
  }

  /**
   * The compact tree, found by the container query that hides it.
   *
   * By that class rather than by a test id, because it is the same string the
   * layout is decided by: a test that looked the tree up some other way would
   * go on passing if the compact form were left drawn at every width.
   */
  const compact = () => document.querySelector('[class*="@min-[300px]/page:hidden"]')!
  /** Every row on whichever of the two screens is drawn. */
  const rows = () => [...compact().querySelectorAll('ul li button, ul li > div')]
  const rowText = () => rows().map((row) => (row.textContent ?? '').trim())
  const press = (text: string) => {
    const row = rows().find((each) => (each.textContent ?? '').trim().startsWith(text))
    expect(row).toBeDefined()
    act(() => (row as HTMLElement).click())
  }

  async function mappedPage(
    context: { epic: string | null; project: string | null; theme: string } = hello.context,
  ) {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost({ ...hello, context })
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: answer,
    })
    await waitFor(() => expect(compact()).not.toBeNull())
    return { sent, fromHost }
  }

  test('it is a drill-down, and the map is still drawn for the widths that can hold it', async () => {
    await mappedPage()
    expect(compact().querySelector('nav[aria-label="breadcrumb"]')).not.toBeNull()
    /*
     * Both trees are in the document and CSS hides one. The alternative —
     * measuring the column in JavaScript and rendering one of them — would make
     * the layout depend on a `ResizeObserver` having fired, which draws the
     * wrong one on a frame's first paint.
     */
    expect(document.querySelector('nav[aria-label="Projects"]')).not.toBeNull()
  })

  test('what chooses between them is the column’s width, not the window’s', async () => {
    await mappedPage()

    /*
     * A media query in a framed module is evaluated against the frame's
     * viewport, which is the pane — nearly right, and wrong past a thousand
     * pixels, where the pane keeps growing and this `max-w-5xl` column does not.
     * The same argument as the grid's columns, and the same kind of assertion,
     * because happy-dom has no layout to compute a real one from.
     */
    expect(compact().className).toContain('@min-[300px]/page:hidden')
    expect(compact().className).not.toMatch(/(^|\s)(sm|md|lg|xl):/)

    const wide = document.querySelector('nav[aria-label="Projects"]')!.closest('[class~="hidden"]')
    expect(wide).not.toBeNull()
    expect(wide!.className).toContain('@min-[300px]/page:block')
  })

  test('the first screen is project names and counts, and carries nothing else', async () => {
    await mappedPage()

    /*
     * The count sits against the name with no word between them, which is the
     * assertion and not an accident of `textContent`: every row on this screen
     * is a project and every number on it is a count of epics, so "6 epics"
     * thirteen times is thirteen copies of a word that says nothing.
     */
    expect(rowText()).toEqual(['Roadmap1', 'Courier1'])
    /*
     * And none of what the wide map draws around a title. The host sent a lede
     * and slugs; the compact tree is where they must not appear, because
     * repeating the card's contents in a narrow pane is what made this a
     * smaller map rather than a different question.
     */
    const said = compact().textContent ?? ''
    expect(said).not.toContain('A setting that is off stays off')
    expect(said).not.toContain('off-means-off')
  })

  test('pressing a project shows its epics, and the breadcrumb says which project', async () => {
    await mappedPage()
    press('Roadmap')

    expect(rowText()).toEqual(['Off means off9'])
    const trail = compact().querySelector('nav[aria-label="breadcrumb"]')!
    expect((trail.textContent ?? '').replace(/\s+/g, ' ')).toContain('Home')
    expect(trail.textContent).toContain('Roadmap')
    // The epics of the project that was not pressed are not on this screen.
    expect(compact().textContent).not.toContain('The lone one')
  })

  test('the back button returns to the projects, and so does the Home crumb', async () => {
    await mappedPage()

    press('Roadmap')
    const back = [...compact().querySelectorAll('button')].find(
      (button) => (button.textContent ?? '').trim() === 'Projects',
    )
    expect(back).toBeDefined()
    act(() => back!.click())
    expect(rowText()).toEqual(['Roadmap1', 'Courier1'])

    /*
     * And the crumb again, because the two are deliberately not one control —
     * one is a location and the other is an action — and a redesign that
     * quietly dropped either would leave this passing on the other.
     */
    press('Courier')
    const home = compact().querySelector('nav[aria-label="breadcrumb"] button')
    expect(home).not.toBeNull()
    expect(home!.textContent).toBe('Home')
    act(() => (home as HTMLElement).click())
    expect(rowText()).toEqual(['Roadmap1', 'Courier1'])
  })

  test('nothing is marked on arrival', async () => {
    await mappedPage()
    press('Roadmap')
    /*
     * Choosing an epic asks the host to MOVE, so a row that arrived marked
     * would be this page claiming somebody is somewhere they are not.
     */
    expect(compact().textContent).not.toContain('open')
  })

  test('except the epic the host itself reports as open', async () => {
    await mappedPage({ epic: 'the-lone-one', project: 'Courier', theme: 'light' })
    /*
     * And the form opens inside that project rather than on the list, because
     * the host said where the reader is standing and drilling in asks nobody
     * anything.
     */
    const marked = rows().find((row) => (row.textContent ?? '').includes('The lone one'))
    expect(marked).toBeDefined()
    expect(marked!.textContent).toContain('open')
  })

  test('pressing an epic asks the host to move, once, naming that epic', async () => {
    const { sent } = await mappedPage()
    press('Roadmap')
    const before = sent.filter((m: any) => m.type === MESSAGE.REQUEST).length
    press('Off means off')

    await waitFor(() =>
      expect(sent.filter((m: any) => m.type === MESSAGE.REQUEST).length).toBe(before + 1),
    )
    const move = sent.filter((m: any) => m.type === MESSAGE.REQUEST)[before]
    expect(move.params).toEqual({ epic: 'off-means-off' })
  })

  test('a host with no such method leaves the rows unpressable and says why, in its words', async () => {
    const { sent, fromHost } = await mappedPage()
    press('Roadmap')

    const said = () =>
      [...compact().querySelectorAll('p')].map((p) => (p.textContent ?? '').trim())
    expect(said()).toContain('Choosing one asks the host to show it.')

    press('Off means off')
    const move = sent.filter((m: any) => m.type === MESSAGE.REQUEST).at(-1)
    fromHost({
      type: MESSAGE.RESPONSE,
      id: move.id,
      ok: false,
      reason: 'unknown-method',
      error: 'this host has no view.goto and will not grow one while the page is open',
    })

    /*
     * Two things at once, and they are one rule: the rows stop being buttons
     * AND a sentence appears saying why. Either without the other is the
     * failure this app is built to avoid — a dead control with no explanation,
     * or an explanation of something that still looks pressable.
     */
    await waitFor(() =>
      expect(said()).toContain(
        'this host has no view.goto and will not grow one while the page is open',
      ),
    )
    expect(compact().querySelectorAll('ul li button').length).toBe(0)
    expect(rowText()).toEqual(['Off means off9'])
  })

  test('every absence keeps its own sentence, and no list is offered for any of them', async () => {
    /*
     * Asserted over all six screens at once rather than one test per screen,
     * because the failure this guards against is not "one of them is wrong", it
     * is "two of them became the same" — and that is only visible by comparing
     * them. A compact layout is exactly where two sentences get collapsed into
     * one to save a line.
     */
    const reached: Record<string, string> = {}

    const respondWith = (id: string, message: Record<string, unknown>) => {
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: MESSAGE.RESPONSE, id, ...message },
            source: window.parent as never,
          }),
        )
      })
    }

    const asked = async () => {
      const { sent, fromHost } = frameIt()
      render(<App />)
      fromHost(hello)
      await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
      return sent.find((m) => m.type === MESSAGE.REQUEST).id
    }

    const settle = async (name: string, headline: string) => {
      await waitFor(() => expect(screen.getByText(headline)).toBeDefined())
      reached[name] = document.body.textContent ?? ''
      expect(document.querySelector('nav[aria-label="breadcrumb"]')).toBeNull()
      expect(compact()).toBeNull()
      cleanup()
    }

    unframe()
    render(<App />)
    await settle('unframed', words({ kind: 'unframed' }).headline)

    frameIt()
    render(<App />)
    await settle('ungreeted', words({ kind: 'ungreeted' }).headline)

    await asked()
    await settle('asked', words({ kind: 'asked' }).headline)

    respondWith(await asked(), { ok: false, reason: 'failed', error: 'the store is not open' })
    await settle('refused', words({ kind: 'refused', reason: 'failed', error: '' }).headline)

    respondWith(await asked(), { ok: true, data: { total: 12 } })
    /*
     * The reading is not read by these words — the sentence is about the shape
     * of the conversation, not about what came back — so an empty one is enough
     * to reach the string, and constructing a real `Reading` here would only be
     * this test asserting `reading.ts` a second time.
     */
    await settle(
      'unreadable',
      words({
        kind: 'unreadable',
        reading: { shape: 'unrecognised', under: null, offered: 0, epics: [], skipped: [] },
      }).headline,
    )

    respondWith(await asked(), { ok: true, data: { epics: [] } })
    await settle('none', words({ kind: 'none' }).headline)

    const texts = Object.values(reached)
    expect(texts.length).toBe(6)
    expect(new Set(texts).size).toBe(6)
  })

  test('a project the host named and described no epics for is not the "no epics" screen', async () => {
    await mappedPage({ epic: null, project: 'A Project Nothing Describes', theme: 'light' })

    /*
     * The drill-down opens inside that project, because the host says the
     * reader is standing in it — so this is the screen a reader actually gets,
     * and it has to say which absence it is. `getAllByText`, because the wide
     * tree draws the same sentence in its own section, which is the whole point
     * of the two of them sharing one string.
     */
    expect(screen.getAllByText(UNDESCRIBED_PROJECT.body).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('The host answered: it has no epics yet.')
    // And no epic list where there are no epics, pressable or otherwise.
    expect(compact().querySelectorAll('ul li').length).toBe(0)
  })
})

/**
 * The short form, in a pane with no height.
 *
 * Whether it FITS is the whole point of it and is not settleable here: happy-dom
 * answers zero to every measurement and applies no stylesheet, so all three
 * layouts are equally "visible" to it. The pixels are asserted in a browser
 * against a real pane. What is settleable without one is that the tree exists,
 * that the height decides it and the height alone, that the two forms of picker
 * are both drawn and chosen by width, and — the thing that made this a change to
 * the page rather than a new component — that all three layouts navigate ONE
 * reader, not three.
 */
describe('the short form, in a pane with no height', () => {
  const answer = {
    epics: [
      { slug: 'off-means-off', title: 'Off means off', project: 'Roadmap', steps: 9 },
      { slug: 'a-green-gate', title: 'A green gate', project: 'Roadmap' },
      { slug: 'the-lone-one', title: 'The lone one', project: 'Courier' },
    ],
  }

  /**
   * The short tree, found by the attribute the probe finds it by, and its
   * wrapper by the media query that hides it — the same string the layout is
   * decided by, so a test that looked it up some other way would go on passing
   * if the strip were left drawn at every height.
   */
  const strip = () => document.querySelector('[data-layout="strip"]')!
  const chip = (text: string) =>
    [...strip().querySelectorAll('[data-chip]')].find(
      (each) => (each.textContent ?? '').trim() === text,
    )

  async function mappedPage(
    context: { epic: string | null; project: string | null; theme: string } = hello.context,
    state: string | null = null,
  ) {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost({ ...hello, context, state })
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: answer,
    })
    await waitFor(() => expect(document.querySelector('[data-layout="strip"]')).not.toBeNull())
    return { sent, fromHost }
  }

  test('all three layouts are in the document, and the third is chosen by HEIGHT', async () => {
    await mappedPage()

    const short = strip().closest('[class*="short:"]')!
    expect(short.className).toContain('short:block')
    /*
     * A media query, and the only one on this page. Every width decision here
     * is asked of the column through a container query, because the column is
     * `max-w-5xl` and the pane is not; nothing caps the page's HEIGHT, so the
     * frame's viewport is the honest answer for height and the wrong one for
     * width. See the essay in `styles.css`.
     */
    expect(short.className).not.toMatch(/@\w+[-[]/)
    // And the other two are still there, chosen by the width of the column.
    expect(document.querySelector('nav[aria-label="breadcrumb"]')).not.toBeNull()
    expect(document.querySelector('nav[aria-label="Projects"]')).not.toBeNull()
  })

  test('the two forms that ordinary panes get are hidden by ONE query, not by two racing', async () => {
    await mappedPage()

    /*
     * `short:hidden` is a media query and `@min-[300px]/page:block` is a
     * container query. Two of those on one element are two rules of equal
     * weight whose winner is whichever Tailwind emitted last — a layout that
     * works because of a sort order breaks on an upgrade, silently, in the
     * shape nobody resizes to. So the height hides a wrapper and the width
     * decides inside it.
     */
    const drill = document.querySelector('[class*="@min-[300px]/page:hidden"]')!
    const map = document.querySelector('nav[aria-label="Projects"]')!.closest('[class~="hidden"]')!
    for (const form of [drill, map]) {
      expect(form.className).not.toContain('short:')
    }
    expect(drill.closest('[class*="short:hidden"]')).not.toBeNull()
    expect(map.closest('[class*="short:hidden"]')).not.toBeNull()
  })

  test('it draws two pickers two ways, and the width chooses between them', async () => {
    await mappedPage()

    const selects = strip().querySelector('[data-pickers="selects"]')!
    const lists = strip().querySelector('[data-pickers="lists"]')!
    expect(selects.className).toContain('@min-[420px]/page:hidden')
    expect(lists.className).toContain('@min-[420px]/page:flex')
    /*
     * A container query on the column, like every other width decision here —
     * not `sm:`, which would be the frame's viewport rather than this column,
     * and which past a thousand pixels measures space the pickers never get.
     */
    for (const form of [selects, lists]) {
      expect(form.className).not.toMatch(/(^|\s)(sm|md|lg|xl):/)
    }
  })

  test('the epic picker holds what the HOST says is open, and pressing does not set it', async () => {
    await mappedPage({ epic: 'off-means-off', project: 'Roadmap', theme: 'light' })

    expect(chip('Off means off')!.getAttribute('aria-current')).toBe('page')
    expect(chip('A green gate')!.getAttribute('aria-current')).toBeNull()

    /*
     * Pressing asks the host to move; it does not mark anything. The marker is
     * where `roadmap.context` says the reader is, which is the only source for
     * where anybody actually ended up — the same rule the cards and the rows
     * follow, applied to a control that has somewhere to put a value. This is
     * the whole of why a select is safe here where the first build's pair was
     * not: there is no second pick to go stale.
     */
    act(() => (chip('A green gate') as HTMLElement).click())
    expect(chip('A green gate')!.getAttribute('aria-current')).toBeNull()
    expect(chip('Off means off')!.getAttribute('aria-current')).toBe('page')
  })

  test('picking a project in the short form moves the drill-down too', async () => {
    /*
     * The reason this was a change to the page and not a new component. Both
     * trees are in the document at once — CSS hides one, nothing unmounts it —
     * so two copies of the navigation would not even be reset by a resize: a
     * reader who picks a project in a short pane and drags it tall would find
     * the other component's untouched state, at Home, and would reasonably read
     * that as the page having forgotten.
     */
    await mappedPage()
    act(() => (chip('Courier') as HTMLElement).click())

    const crumb = document.querySelector('nav[aria-label="breadcrumb"]')!
    expect(crumb.textContent).toContain('Courier')
    // And the drill-down is showing that project's epics, not the other's.
    const compactTree = document.querySelector('[class*="@min-[300px]/page:hidden"]')!
    expect(compactTree.textContent).toContain('The lone one')
    expect(compactTree.textContent).not.toContain('Off means off')
  })

  test('and the host is asked to keep it, once, in the shape `keep.ts` writes', async () => {
    const { sent } = await mappedPage()
    act(() => (chip('Courier') as HTMLElement).click())

    const kept = sent.filter(
      (m) => m.type === MESSAGE.REQUEST && typeof m.method === 'string' && m.method.startsWith('state.'),
    )
    expect(kept.length).toBe(1)
    expect(JSON.parse(kept[0].params.state)).toMatchObject({ at: 'epics', p: 'Courier' })
  })

  test('a place the host remembered opens the short form there, not at Home', async () => {
    await mappedPage(hello.context, JSON.stringify({ v: 1, at: 'epics', p: 'Courier' }))
    await waitFor(() => expect(chip('Courier')?.getAttribute('aria-pressed')).toBe('true'))
    expect(chip('The lone one')).toBeDefined()
    expect(chip('Off means off')).toBeUndefined()
  })

  test('with nobody to ask, there is no strip and no dead control', async () => {
    unframe()
    render(<App />)
    /*
     * Standalone there is no map at all, so there is nothing for a strip to
     * pick from — the absence is drawn instead, at every height, in the words
     * every other size gets.
     */
    expect(document.querySelector('[data-layout="strip"]')).toBeNull()
    expect(screen.getByText(words({ kind: 'unframed' }).headline)).toBeDefined()
  })

  test('the absence screens are drawn once, not once per layout', async () => {
    /*
     * The short form does not get its own copy of them. They are the six
     * sentences this app exists to keep apart, and a second set for short panes
     * would be a second set to hold in step with the first; drawing the same
     * component twice was worse still, because both copies are in the
     * accessibility tree and every query for the sentence finds two.
     */
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost(hello)
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: { epics: [] },
    })
    const said = words({ kind: 'none' }).headline
    await waitFor(() => expect(screen.getAllByText(said).length).toBe(1))
  })
})

/**
 * What the short form says, given that it has almost no room to say anything.
 *
 * Its own section because it is the one place this app deliberately breaks a
 * rule it argues for elsewhere: `chooser.ts` requires a list that moves somebody
 * to state, in prose and always, whether it can. The strip does not, because
 * that sentence is a sixth of a 120-pixel pane spent on a line read once — and
 * these are the assertions that the protection the rule was for survived the
 * prose being dropped.
 */
describe('the short form’s prose, and where it went', () => {
  const answer = {
    epics: [
      { slug: 'off-means-off', title: 'Off means off', project: 'Roadmap', steps: 9 },
      { slug: 'a-green-gate', title: 'A green gate', project: 'Roadmap' },
    ],
  }

  const strip = () => document.querySelector('[data-layout="strip"]')!
  const epicItems = () => [...strip().querySelectorAll('[aria-label="Epics"] [data-chip]')]

  async function mapped() {
    const { sent, fromHost } = frameIt()
    render(<App />)
    fromHost({ ...hello, context: { epic: null, project: 'Roadmap', theme: 'light' } })
    await waitFor(() => expect(sent.some((m) => m.type === MESSAGE.REQUEST)).toBe(true))
    fromHost({
      type: MESSAGE.RESPONSE,
      id: sent.find((m) => m.type === MESSAGE.REQUEST).id,
      ok: true,
      data: answer,
    })
    await waitFor(() => expect(document.querySelector('[data-layout="strip"]')).not.toBeNull())
    return { sent, fromHost }
  }

  /** Answer the module's outstanding `view.goto` however the test needs. */
  const answerTravel = (
    sent: any[],
    fromHost: (m: unknown) => void,
    body: Record<string, unknown>,
    ok = true,
  ) => {
    const ask = [...sent].reverse().find((m) => m.type === MESSAGE.REQUEST && m.method === 'view.goto')
    expect(ask).toBeDefined()
    fromHost({ type: MESSAGE.RESPONSE, id: ask.id, ok, ...(ok ? { data: body } : body) })
  }

  test('the standing sentence costs no height, and is on the controls instead', async () => {
    await mapped()

    /*
     * No element, rather than an empty one: an empty `<p>` holds its
     * line-height open for a sentence that is not there and spends the pixels
     * anyway. The measured cost of drawing it was 20 of a 120-pixel pane, which
     * is the difference between six epics visible at 500 wide and three.
     */
    expect(strip().querySelector('p')).toBeNull()

    // And it is one hover or one screen reader away, on every control that moves.
    const first = epicItems()[0]!
    expect(first.getAttribute('title')).toBe('Choosing one asks the host to show it.')
    /*
     * The `aria-label` carries the NAME as well as the sentence. A label that
     * replaced the name would trade a caption for the thing being captioned.
     */
    expect(first.getAttribute('aria-label')).toContain('Off means off')
    expect(first.getAttribute('aria-label')).toContain('asks the host to show it')
  })

  test('but what the host says about an attempt does get a line', async () => {
    const { sent, fromHost } = await mapped()
    act(() => (epicItems()[1] as HTMLElement).click())
    act(() =>
      answerTravel(sent, fromHost, {
        outcome: 'declined',
        epic: null,
        why: 'the reader has unsaved edits open',
      }),
    )

    /*
     * News, not instructions: the answer to a question the reader has just
     * asked by pressing something, and the one case where prose in a strip is
     * worth its pixels.
     */
    await waitFor(() =>
      expect(strip().querySelector('p')?.textContent).toBe('the reader has unsaved edits open'),
    )
    // Announced, because it appeared in response to a press rather than a move.
    expect(strip().querySelector('p')?.getAttribute('aria-live')).toBe('polite')
  })

  test('a move says nothing, because the canvas already said it', async () => {
    const { sent, fromHost } = await mapped()
    act(() => (epicItems()[1] as HTMLElement).click())
    act(() => answerTravel(sent, fromHost, { outcome: 'moved', epic: 'a-green-gate', why: '' }))

    await waitFor(() => expect(strip().querySelector('p')).toBeNull())
  })

  test('where nothing can be asked, the items are not controls at all', async () => {
    const { sent, fromHost } = await mapped()
    act(() => (epicItems()[0] as HTMLElement).click())
    act(() =>
      answerTravel(
        sent,
        fromHost,
        { reason: 'unknown-method', error: 'this host cannot be asked to move' },
        false,
      ),
    )

    /*
     * The protection the dropped sentence was providing, kept structurally.
     * There is no false affordance to warn anybody about, because there is no
     * affordance: `cannot-ask` is sticky, so every item becomes inert text and
     * carries the host's own reason where the standing sentence used to be.
     */
    await waitFor(() => expect(epicItems()[0]!.tagName).toBe('SPAN'))
    expect(epicItems().every((each) => each.tagName === 'SPAN')).toBe(true)
    expect(epicItems()[0]!.getAttribute('title')).toContain('cannot be asked to move')
    // And it is not ALSO printed as a line, which would be the same sentence twice.
    expect(strip().querySelector('p')).toBeNull()
  })

  test('the strip uses the whole pane, where the reading column does not', async () => {
    await mapped()

    /*
     * `max-w-5xl` is a reading measure and the strip is not made of sentences —
     * under the cap, a 1600-pixel band drew its epics in a 1024-pixel column
     * with 290 pixels of nothing down each side, which is the layout that
     * trades width for height declining most of the width it was given.
     */
    const ruler = document.querySelector('[class*="@container/page"]')!
    expect(ruler.className).toContain('max-w-5xl')
    expect(ruler.className).toContain('short:max-w-none')
  })
})
