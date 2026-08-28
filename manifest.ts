import { MANIFEST_KIND, METHODS, PROTOCOL, manifestSchema, own } from 'roadmap-module-protocol'
import { GET_EPIC, GOTO, KEEP_STATE, LIST_EPICS } from './atlas/methods.ts'

export const ID = 'roadmap.atlas'
export const VERSION = '1.0.0'

/**
 * What this app says about itself when a host asks.
 *
 * The manifest is the smallest half of this program and the only half a host
 * ever reads before deciding whether to frame it. Everything else here runs
 * with nothing on the other end, so read this as a description of what changes
 * WHEN there is a host: which tab to give the page, and which two questions the
 * app would like to ask if there is anybody there to answer.
 *
 * ## What is declared
 *
 * Atlas draws a map of the territory: the projects, and the epics inside each.
 * It holds none of that material — it has no store at all — so the whole of what
 * it does depends on being able to ask for it, and on being able to ask the host
 * to show what a reader pressed.
 *
 * Both declarations are DERIVED from the protocol's own `METHODS` table rather
 * than typed out, so a rename in the package cannot leave this manifest naming a
 * capability that does not go with the method actually called. The navigation
 * one appears only if the installed protocol has the method: a module declaring
 * an intention it has no way to act on would be a false sentence on the panel
 * where somebody decides whether to install it.
 *
 * Nothing else is declared, and each absence is a decision:
 *
 * - **The steps capability — not asked for.** Atlas draws how BIG an epic is,
 *   never what is in it. Reading every epic's steps to count them would be this
 *   app asking for a great deal of somebody else's material to render one
 *   number that the list answer very often carries already.
 * - **The live-tracker capability — not asked for.** A map of what exists is
 *   not a status board. The moment this page showed how many issues are open in
 *   each project it would stop being a thing you can take in at a glance and
 *   become a second, disagreeing copy of whatever the host's own page says.
 * - **Reporting a stage — not asked for.** Nothing here is a place to say where
 *   work has got to. This app writes nothing anywhere: asking the host to move
 *   is the only thing it does that is not a question, and even that changes
 *   nothing but what is on screen.
 * - **Extensions — none, in either direction.** Atlas emits nothing and shows
 *   nothing anybody else emits.
 * - **Storage — false.** No cookies, no localStorage, no IndexedDB, and so an
 *   opaque origin. There is nothing to remember: every screen is a function of
 *   one answer to one question, and a cache would mean this app could show a
 *   map after the host stopped being willing to describe one. That is exactly
 *   the failure the honest-absence screens exist to prevent, and a cache would
 *   reintroduce it through the back door.
 * - **No tracker access, and no field that could ask for it.** This app holds no
 *   credential and has no code path that opens a socket to anything but the
 *   server that served it.
 *
 * ## The mode, and why its scope is `epic` when the page is about all of them
 *
 * One mode, and it looks like it should be `global`: Atlas draws every project
 * and every epic, and `global` is the scope for a page over the whole roadmap.
 *
 * It is `epic`, which means "follows the reader — told which epic is open, and
 * told again on every switch". The difference is the marker. A `global` mode is
 * never sent `roadmap.context`, so a map with `global` scope could show
 * everything and never show WHERE YOU ARE, and would go on not showing it as
 * the reader moved around. Being told costs one message per switch and is the
 * difference between a map and a map with a pin in it.
 *
 * The scope's spelling changed under this app while it was being written, from
 * `journey` to `epic`, along with the methods and the context field. The value
 * is a literal in somebody else's enum rather than a string this app chooses, so
 * unlike the method names in `atlas/methods.ts` it cannot be resolved — it is
 * written out, and it is the one place a further rename would need an edit here.
 */

/**
 * The capability that goes with the call actually made.
 *
 * `own()` rather than `METHODS[name]`, because the method name here is resolved
 * at startup and the protocol package's `methods.ts` says in as many words that
 * this lookup is one of the three that arrive from outside and must not fall
 * through a prototype. It is a small thing to get right and the failure — a
 * declaration reading `[object Object]` under this app's name on somebody's
 * panel — is exactly the kind the package's essay describes.
 */
function capabilityFor(method: string): string[] {
  const capability = own(METHODS as Record<string, string>, method)
  return capability ? [capability] : []
}

const uses = [
  ...new Set([
    ...capabilityFor(LIST_EPICS),
    ...capabilityFor(GET_EPIC),
    ...(GOTO ? capabilityFor(GOTO) : []),
    ...(KEEP_STATE ? capabilityFor(KEEP_STATE) : []),
  ]),
]

/**
 * Validated here, at startup, with the same schema a host will run.
 *
 * The package's README is clear that importing `manifestSchema` is a
 * convenience and never the host's check — the host runs its own copy over what
 * it fetched, and must. What it buys on this side is that this app cannot
 * publish a manifest its own dependency would reject: the bound that would have
 * been discovered as a refusal on somebody else's screen is discovered here, on
 * the first line of the first run, by the program that wrote the document.
 */
export const MANIFEST = manifestSchema.parse({
  kind: MANIFEST_KIND,
  protocol: PROTOCOL,
  id: ID,
  name: 'Atlas',
  version: VERSION,
  summary: 'A map of the territory: which projects exist, and which epics are in each of them.',
  /**
   * What an agent should do about this module, given that it is here.
   *
   * Not the summary: that says what this IS, for a person deciding whether to
   * place it. This says what its PRESENCE OBLIGES, and a host composes it into
   * the prompt every agent on the canvas is handed — attributed to this module,
   * because it is this module's claim rather than the host's.
   */
  guidance:
    'The projects and epics that exist are all listed here, so whatever is open on this kehikko is ' +
    'not the whole picture. If work seems to belong to a different epic than the one open, say so ' +
    'rather than filing it where you happen to be standing. Opening an epic here moves the entire ' +
    'canvas, so do it deliberately: every other module will follow you to it.',
  entry: '/app',
  health: '/healthz',
  modes: [{ id: 'atlas', label: 'Atlas', scope: 'epic' }],
  extensions: { emits: [], consumes: [] },
  declares: {
    protocol: `>=${PROTOCOL} <${PROTOCOL + 1}`,
    uses,
    storage: false,
  },
})
