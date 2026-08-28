import { METHOD_NAMES } from 'roadmap-module-protocol'

/**
 * The questions this app asks, resolved out of the package rather than written
 * down here.
 *
 * ## Why these are not string literals
 *
 * A method name is a spelling two programs must agree on exactly — the protocol
 * package says so itself, and it is why `METHODS` exists there at all. Importing
 * the constant and using it is the whole of the right answer, and everywhere
 * this app can do that directly it does.
 *
 * This file exists because the package's vocabulary moved while this app was
 * being written. It named the list method `journeys.list` and its context
 * carried a journey slug, both leftovers from a codebase where epics and
 * journeys were one idea; the rename to `epics.list` and `epic.get` landed
 * mid-build, along with `view.goto`, and `PROTOCOL` went to 2 for it.
 *
 * So the names are RESOLVED rather than asserted: each question has the
 * spellings that would mean it, in order of preference, and the first one the
 * installed package actually exports wins. If none is there, this throws at
 * import — loudly, at startup, naming what it looked for — because the
 * alternative is an app that runs, asks a method no host knows, and shows a
 * refusal screen that blames the host for this app's stale vocabulary.
 *
 * The old spellings are kept as second choices and should be deleted when
 * nothing in the wild answers to them. They cost one array element and they
 * mean this app survives being pointed at either version of its own dependency.
 */

/**
 * Pick the first spelling the package knows.
 *
 * `METHOD_NAMES` is an array, so this is a membership test over a list rather
 * than a keyed lookup on an object — no prototype to fall through, which is the
 * hazard the package's `ids.ts` is about and which it says applies to method
 * names specifically.
 */
function resolve(candidates: readonly string[]): string | null {
  const known: readonly string[] = METHOD_NAMES
  for (const candidate of candidates) {
    if (known.includes(candidate)) return candidate
  }
  return null
}

function required(what: string, candidates: readonly string[]): string {
  const found = resolve(candidates)
  if (found) return found
  throw new Error(
    `roadmap-module-protocol names no method for ${what}. Looked for ${candidates.join(', ')}; ` +
      `it exports ${METHOD_NAMES.join(', ')}. Atlas cannot ask a question the protocol does not name.`,
  )
}

/** Every epic the host has: the one call this app cannot work without. */
export const LIST_EPICS = required('listing epics', ['epics.list', 'journeys.list'])

/** One epic in more detail. */
export const GET_EPIC = required('reading one epic', ['epic.get', 'journey.get'])

/**
 * Ask the host to show an epic.
 *
 * Optional, and the only one of the three that is. Everything above is a
 * question about material and a host that cannot answer it leaves this app with
 * nothing to draw; this one is a request to MOVE, and a protocol without it is
 * one where a map is a thing you read rather than travel on. That was the state
 * of the protocol when this app was started, and `page/components/travel.tsx`
 * still contains the account of what it was like.
 *
 * Null when the installed package does not name it. Null is drawn — the page
 * says plainly that this host's protocol has no way to ask — rather than
 * hidden, because a row that silently stops being pressable is a row somebody
 * thinks is broken.
 */
export const GOTO: string | null = resolve(['view.goto'])
