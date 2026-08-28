/**
 * The one message listener this page has, installed the moment this file is
 * imported and never removed.
 *
 * ## Why this exists, which is a bug worth writing down
 *
 * The host greets a frame on the frame's `load` event, and that is correct: a
 * module greeted before its own script has run never hears the greeting, so the
 * host waits for the browser to say the document is there.
 *
 * But `load` fires when the document and its subresources are ready, and a
 * React application is not ready then. `createRoot().render()` schedules work;
 * effects run after that work commits, in a task of their own. So a listener
 * added inside `useEffect` is added STRICTLY AFTER `load` — which means the
 * greeting had already been posted, into a page that was not yet listening, and
 * was gone. Nothing retries: the host has said its one word, the module never
 * answers, and after a few seconds the pane reads "loaded its page and did not
 * answer the host's greeting". Which was true, and gave no hint that the
 * greeting arrived four hundred milliseconds before anybody was there to hear
 * it.
 *
 * `StrictMode` makes it worse rather than revealing it: the deliberate
 * double-mount attaches, detaches and re-attaches, so in development there is a
 * window with no listener at all in the middle of startup.
 *
 * So the listener is installed here, at module scope, synchronously, before
 * React is asked to do anything. Anything that arrives before the application
 * is ready is kept, and handed over when it asks. The application still owns
 * every decision about the wire; what it no longer owns is the question of
 * whether anybody was listening yet.
 *
 * The buffer is not a queue that drains and stops. It is a listener with a
 * backlog: a subscriber gets what was missed and then everything after it, and
 * mounting twice does not install a second listener on the window.
 */

type Envelope = { source: MessageEventSource | null; data: unknown }
type Deliver = (envelope: Envelope) => void

const backlog: Envelope[] = []
let deliver: Deliver | null = null

/**
 * How much is kept while nothing is listening.
 *
 * A greeting, a context and a handful of answers is the real backlog; anything
 * beyond that is a page that has not mounted for long enough that its problem
 * is not the buffer. Bounded so a host talking to a dead page cannot grow this
 * array without limit — the oldest go first, because the newest are the ones
 * still worth acting on.
 */
const KEEP = 64

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
    const envelope: Envelope = { source: event.source, data: event.data }
    /*
     * Recorded ALWAYS, delivered as well when somebody is listening.
     *
     * The early version only recorded while nobody was subscribed, on the
     * reasoning that a message handed to a live subscriber has been dealt with.
     * That reasoning has a hole exactly one `StrictMode` wide, and the greeting
     * fell through it — see `subscribe` below.
     */
    backlog.push(envelope)
    if (backlog.length > KEEP) backlog.shift()
    deliver?.(envelope)
  })
}

/**
 * Take over delivery, receiving everything that has arrived at all.
 *
 * ## The backlog is a transcript, not a queue, and it took two attempts to say so
 *
 * The first version took the backlog away as it handed it over — read once,
 * then empty. That is correct for a queue and wrong here, because `StrictMode`
 * subscribes, unsubscribes and subscribes again on purpose: the first
 * subscription drained the greeting, the connection that received it was thrown
 * away by the very unmount React was testing, and the second subscription
 * arrived to an empty backlog.
 *
 * The second version replayed instead of draining, which fixed that case and
 * left a smaller one open, because the RECORDING was still conditional: a
 * message was only kept while nobody was subscribed. So a greeting that landed
 * inside the `StrictMode` window — after the doomed first subscription, before
 * its unmount — was delivered to that subscriber and never written down. The
 * surviving mount replayed a backlog the greeting had never been in.
 *
 * That failure had a signature worth recognising, because it looks impossible:
 * the HOST said the module was ready and the MODULE said nothing had greeted
 * it, both truthfully. The discarded connection really did answer the greeting
 * — the host's `ready` came from a `Connection` that was already garbage — and
 * the connection the page was actually using had never heard a word.
 *
 * So now every message is recorded and then delivered, and every subscriber
 * replays the whole transcript. What that costs is a duplicate: a mount that
 * already answered a greeting, and is then replaced, answers it again. That is
 * fine and it is fine on purpose — a second `ready` is the same sentence as the
 * first, the host takes a module at its word either way, and a duplicated
 * answer is a far smaller thing to be wrong about than a lost one. Losing it is
 * silence; repeating it is noise.
 */
export function subscribe(next: Deliver): () => void {
  for (const envelope of backlog) next(envelope)
  deliver = next
  return () => {
    if (deliver === next) deliver = null
  }
}
