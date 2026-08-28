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
