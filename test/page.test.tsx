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

    await waitFor(() => expect(screen.getByText('open')).toBeDefined())
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
