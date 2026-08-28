import { Connection, type ConnectionEvents } from '../atlas/connection.ts'
import { subscribe } from './mailbox.ts'
import { ID } from '../manifest.ts'

/**
 * The browser plumbing, and nothing else.
 *
 * Every decision about the wire lives in `atlas/connection.ts`, which has no
 * `window` in it and is tested without a browser. What is left is this file:
 * find the host, listen, post, stop listening. There is deliberately nothing
 * here worth testing, and that is the point of the split — the code that is hard
 * to test does not decide anything, and the code that decides things is easy to
 * test.
 */

/**
 * Is anything framing this page?
 *
 * `window.parent === window` is true exactly when this document is the top of
 * its own browsing context — opened directly, in a tab, by a person. It is not
 * a security check and could not be one; it is how the page tells "there is
 * nobody to ask" from "there is somebody and they have not spoken yet", which
 * are two different sentences on screen and the whole reason `situation.ts`
 * exists.
 */
export function isFramed(): boolean {
  return typeof window !== 'undefined' && window.parent !== window
}

export interface Attached {
  connection: Connection
  /**
   * Begin receiving, and hand back the way to stop.
   *
   * ## Why listening is a second step instead of part of attaching
   *
   * Because the greeting can arrive DURING this call, and the caller has to be
   * ready before it does.
   *
   * The mailbox replays whatever came in before anybody was listening, and it
   * replays it synchronously, inside `subscribe`. So `onHello` can run before
   * `subscribe` has returned — which means before `attach` has returned, which
   * means before the caller has had a chance to put the connection anywhere.
   * When attaching and listening were one call, `useAtlas` did the natural
   * thing and stored the connection on the line after; its `onHello` ran first,
   * looked for the connection it was about to be given, found nothing, and
   * returned.
   *
   * That failed in a way worth recognising, because both halves looked
   * healthy: the greeting was answered — `Connection` sends `roadmap.ready`
   * itself and needs nobody's ref to do it — so the HOST saw a module that was
   * ready and speaking, while the module's own screen still read "something is
   * framing this page and has not said hello". Nothing errored, and the one
   * observable symptom was a question that never went out on the wire.
   *
   * Splitting the two makes the order the caller's to get right, and makes
   * getting it wrong look wrong: you cannot listen before you have somewhere to
   * put what you hear.
   */
  listen: () => () => void
}

/**
 * Wire a `Connection` to this window.
 *
 * `'*'` as the target origin, and it is worth saying why rather than leaving it
 * looking careless. A module without `declares.storage` — this one — runs on an
 * opaque origin, so there is no origin string that identifies the host to us and
 * none that identifies us to the host. The protocol package's `wire.ts` says the
 * identity is the window handle, which is a thing the HOST can rely on and this
 * side cannot check at all. So there is no narrower target available, and
 * writing one in would be theatre. What makes it acceptable is that this app
 * sends nothing worth intercepting: a `ready`, a question with no credential in
 * it, and a height.
 */
export function attach(events: ConnectionEvents): Attached {
  const host = window.parent

  const connection = new Connection({
    moduleId: ID,
    send: (message) => host.postMessage(message, '*'),
  })
  connection.on(events)

  return {
    connection,
    /*
     * Subscribing to the mailbox rather than to the window, and the difference
     * is the whole of a bug this page had. The window listener is installed
     * when `mailbox.ts` is imported — synchronously, before React is asked to
     * render. This runs inside an effect, which is strictly after the frame's
     * `load` event, which is when the host greets. Listening on the window here
     * meant the greeting had already come and gone. See the essay in
     * `mailbox.ts`.
     */
    listen: () =>
      subscribe(({ source, data }) => {
        /**
         * Messages from this window to itself are dropped before anything
         * parses them. A page's own bundler posts to its window during
         * development, and so does anything else running in the frame; the host
         * is `window.parent` and nothing else is.
         */
        if (source !== host) return
        connection.receive(data)
      }),
  }
}

/**
 * Tell the host how tall this page wants to be, whenever that changes.
 *
 * A `ResizeObserver` on the document element rather than a window resize
 * listener, because the thing that changes height here is the CONTENT — a
 * project section opening, an answer arriving — and the window never resizes at
 * all inside a frame the host is sizing. `Connection.resize` drops repeats, so
 * the observer firing on every layout pass costs nothing.
 */
export function reportHeight(connection: Connection): () => void {
  const observer = new ResizeObserver(() => {
    connection.resize(document.documentElement.scrollHeight)
  })
  observer.observe(document.documentElement)
  return () => observer.disconnect()
}
