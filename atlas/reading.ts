import { EPIC_SLUG, LIMITS, epicsListResult } from 'roadmap-module-protocol'

/**
 * Reading an answer whose shape is only half promised.
 *
 * The protocol package draws a line through the middle of this, and where the
 * line falls decides everything in this file:
 *
 *   > An answer is **material** when it is a host's own holdings [...] Two
 *   > honest hosts differ there, and a shape imposed on it would be this
 *   > package legislating what a host must hold.
 *
 * So `epics.list` has a spine — `epicsListResult`, which requires a slug, bounds
 * a title and a project if they are there, and passes everything else through —
 * and `epic.get` has nothing at all. Two consequences, and this file is both of
 * them.
 *
 * **The spine is used, and it is not the check.** `epicsListResult` is run
 * first, because a host that answers in the shape the package describes should
 * be read the way the package describes. But the README is emphatic that
 * running one of its schemas is a convenience rather than the check — the
 * checking side is the one that has to do it — so a failure to parse is not the
 * end of the road here. It falls through to a tolerant walk, because a host
 * answering with a bare array of epics has answered a question this app asked
 * and refusing to read it would be this app choosing tidiness over the map.
 *
 * **Everything past the spine is still unpromised.** The lede, the size, and
 * every field this app has never heard of arrive with no shape agreed, and the
 * rules below are all about them.
 *
 * The four rules everything here follows:
 *
 * 1. **A missing field is missing, never zero and never empty.** An epic with
 *    no size is `size: null` and draws no size at all. An epic with no size
 *    drawn as "0 steps" is this app telling the reader something the host never
 *    said. This is the same distinction the protocol's README draws between
 *    "there is nothing" and "nothing has told me", one level down.
 * 2. **A field of the wrong type is treated as absent, not coerced.** A `title`
 *    that arrived as a number is not `String(title)`; it is a title this app
 *    could not read. Coercion is how a host's internal object id ends up on
 *    screen as the name of an epic.
 * 3. **Extra fields are fine.** A host answering with six fields this app has
 *    never heard of is a host doing its job — the spine passes them through on
 *    purpose. So nothing here refuses an entry for carrying more than it
 *    expected, and `unread` records the surplus so the page can say the answer
 *    was richer than what is drawn.
 * 4. **Nothing throws.** Every way an answer can be wrong comes back as data on
 *    the `Reading`, because an exception in a parser is a blank page, and a
 *    blank page is the exact lie this whole app is built to avoid telling.
 */

/**
 * One epic, as much of it as could be read.
 *
 * Every field except `slug` is nullable, because every field except `slug` is
 * one a host may simply not have sent. `slug` is not nullable because an entry
 * with no slug is not an epic this app can do anything with: it cannot be
 * keyed, cannot be told apart from its neighbour, and cannot be matched against
 * anything the host says later.
 */
export interface Epic {
  slug: string
  /** What to call it. Null when the host sent no readable title; the page shows the slug. */
  title: string | null
  /** The line under the title. Null when absent — which is different from empty. */
  lede: string | null
  /** Which project it belongs to. Null when the host filed it under none. */
  project: string | null
  /**
   * Roughly how big it is, in steps.
   *
   * Null when the host said nothing about size. See `sizeOf` for which
   * spellings are read and why the list is short.
   */
  size: number | null
  /** Field names present on the entry that this app did not read. */
  unread: string[]
}

/** What one call to the list method turned into. */
export interface Reading {
  epics: Epic[]
  /**
   * How the answer was packaged. `bare` is a top-level array, `wrapped` is an
   * array found under a name; `unrecognised` means nothing array-shaped was
   * found at all, which is a different screen from an empty list.
   */
  shape: 'bare' | 'wrapped' | 'unrecognised'
  /** When `wrapped`, the property the array was found under. For the diagnostic line. */
  under: string | null
  /** How many entries were in the answer, readable or not. */
  offered: number
  /**
   * Entries that were there and could not be turned into an epic, with the
   * reason. Shown, not swallowed: a host whose answer is half-readable should
   * find that out from the page rather than from a shorter list.
   */
  skipped: { at: number; why: string }[]
}

/* ------------------------------------------------------------------------ *
 * Field access that does not fall through a prototype
 * ------------------------------------------------------------------------ */

/**
 * One field off an object that came out of a frame.
 *
 * `Object.hasOwn` rather than `obj[name]`, and the protocol package spends a
 * page on why (see the essay on `MODULE_ID` in its `ids.ts`). The short version
 * for this file: a host is free to answer with an object whose keys are
 * whatever it likes, and `entry['constructor']` on a plain object answers with
 * a function — truthy, so a naive reader believes it found a title, and the lie
 * surfaces later as a `TypeError` or as a row confidently naming an epic
 * nobody has.
 */
function field(value: unknown, name: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  return Object.hasOwn(value as object, name) ? (value as Record<string, unknown>)[name] : undefined
}

/**
 * A string field, or null.
 *
 * Clipped rather than refused, and the protocol README says why the two
 * treatments differ: a clipped sentence is still the sentence, while a clipped
 * *identifier* is a different identifier. Titles and ledes are prose and are
 * clipped; the slug below is an identifier and is refused.
 *
 * Empty-after-trimming becomes null, because a host that sent `lede: ""` and a
 * host that sent no lede have told this app the same thing, and drawing an
 * empty line for one of them would be drawing a difference that is not there.
 */
function prose(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

/**
 * How big an epic is, if the host said.
 *
 * Three spellings are read: `steps` as a number, `steps` as an array (its
 * length), and `size` as a number. That is a guess about somebody else's
 * vocabulary and it is worth being honest that it is one — the protocol names
 * the question and not the answer, so there is no authoritative spelling to
 * look up.
 *
 * The list is kept SHORT for a specific reason rather than out of laziness.
 * Every extra name is another field this app might read as a size when the host
 * meant something else by it, and a wrong number on screen is worse than no
 * number: the page has an honest way to draw "the host did not say how big this
 * is", and it has no way at all to draw "this number may be about something
 * else". So: the two spellings that plausibly mean steps, and nothing that
 * merely might.
 *
 * A negative or non-integer count is not a size and is read as absent, for the
 * same reason a title that arrived as a number is read as absent.
 */
function sizeOf(entry: unknown): number | null {
  const steps = field(entry, 'steps')
  if (Array.isArray(steps)) return steps.length
  if (typeof steps === 'number' && Number.isInteger(steps) && steps >= 0) return steps
  const size = field(entry, 'size')
  if (typeof size === 'number' && Number.isInteger(size) && size >= 0) return size
  return null
}

/* ------------------------------------------------------------------------ *
 * One entry
 * ------------------------------------------------------------------------ */

/** Field names this reader knows how to use; anything else on an entry is surplus. */
const KNOWN = ['slug', 'title', 'lede', 'project', 'steps', 'size']

/**
 * One entry from the answer, or a reason it could not be one.
 *
 * Exported because it is worth testing on its own: nearly every way a host's
 * answer can surprise this app is a property of this function.
 */
export function readEpic(entry: unknown): { epic: Epic } | { why: string } {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return { why: 'not an object' }
  }

  const rawSlug = field(entry, 'slug')
  if (typeof rawSlug !== 'string') return { why: 'no slug' }
  const slug = rawSlug.trim()
  /**
   * Refused, not clipped and not repaired. A slug is how this app tells one row
   * from another and how it matches a row against anything the host says later;
   * a slug bent into shape would match the wrong row, or no row, and would do it
   * silently. The bound and the pattern are the protocol's own (`EPIC_SLUG`,
   * `LIMITS.EPIC_SLUG`), so an entry refused here is one no host could have expected
   * this app to accept.
   */
  if (!EPIC_SLUG.test(slug)) return { why: `slug is not a slug: ${JSON.stringify(rawSlug.slice(0, 40))}` }

  const present = Object.keys(entry as object)
  const unread = present.filter((name) => !KNOWN.includes(name))

  return {
    epic: {
      slug,
      title: prose(field(entry, 'title'), LIMITS.TITLE),
      lede: prose(field(entry, 'lede'), LIMITS.MESSAGE),
      project: prose(field(entry, 'project'), LIMITS.PROJECT),
      size: sizeOf(entry),
      unread,
    },
  }
}

/* ------------------------------------------------------------------------ *
 * The whole answer
 * ------------------------------------------------------------------------ */

/**
 * Where the list might be, when the spine did not recognise it.
 *
 * The protocol says an `epics.list` answer is `{ epics: [...] }`, and
 * `epicsListResult` is tried first. This list is the fallback, for a host that
 * answered something else: a bare array, or the array under a different name.
 * Both are things a host might reasonably do, and neither is worth a screen
 * saying the answer could not be read.
 *
 * It is exactly these names rather than a hunt through the object for the first
 * array-valued property. Hunting would make this reader's behaviour depend on
 * key order and would happily draw a host's `tags` array as the list of epics.
 *
 * `journeys` is here, last, purely for a host still speaking the protocol's
 * older vocabulary, where the list method was `journeys.list` and the answer
 * would plausibly have been wrapped in the old noun. It is not this app agreeing
 * that the two words mean the same thing — they do not, and a journey belongs to
 * a different program entirely.
 */
const WRAPPERS = ['epics', 'items', 'journeys']

/**
 * Read an answer to the list method.
 *
 * Never throws. Everything that could have gone wrong comes back on the
 * `Reading` as something the page can put into a sentence, because the one
 * outcome worse than an unreadable answer is an unreadable answer drawn as an
 * empty roadmap.
 */
export function readEpics(data: unknown): Reading {
  let list: unknown[] | null = null
  let shape: Reading['shape'] = 'unrecognised'
  let under: string | null = null

  /**
   * The spine first.
   *
   * A host answering in the shape the package describes gets read the way the
   * package describes, and this is where that happens. It is not the check and
   * cannot be: `epicSpine` passes every unknown field through untouched, which
   * is the whole point of it, so the lede, the size and everything else this
   * page draws still arrive unvalidated and still go through `readEpic` below.
   * What running it buys is a definite answer to "was this the agreed shape",
   * which is worth having in the diagnostics — and a guarantee that a host doing
   * exactly what the protocol asks is never read by the guesswork underneath.
   */
  const spined = epicsListResult.safeParse(data)
  if (spined.success) {
    list = spined.data.epics
    shape = 'wrapped'
    under = 'epics'
  } else if (Array.isArray(data)) {
    list = data
    shape = 'bare'
  } else {
    for (const name of WRAPPERS) {
      const held = field(data, name)
      if (Array.isArray(held)) {
        list = held
        shape = 'wrapped'
        under = name
        break
      }
    }
  }

  if (!list) return { epics: [], shape: 'unrecognised', under: null, offered: 0, skipped: [] }

  const epics: Epic[] = []
  const skipped: Reading['skipped'] = []
  /**
   * Two entries with the same slug is a host contradicting itself, and the
   * choice here is to keep the first and record the second rather than draw the
   * epic twice. Drawing it twice is the failure that looks like a bug in the
   * page; recording it is the one that looks like what it is.
   */
  const seen = new Set<string>()

  list.forEach((entry, at) => {
    const read = readEpic(entry)
    if ('why' in read) {
      skipped.push({ at, why: read.why })
      return
    }
    if (seen.has(read.epic.slug)) {
      skipped.push({ at, why: `a second entry for ${read.epic.slug}` })
      return
    }
    seen.add(read.epic.slug)
    epics.push(read.epic)
  })

  return { epics, shape, under, offered: list.length, skipped }
}

/**
 * Read an answer to the get-one method.
 *
 * The same entry reader, because one epic in more detail is still one epic: the
 * extra the host chose to send lands in `unread`, where the page can say how
 * much more this host knows than it is showing. A separate, richer schema for
 * the detail call would be exactly the assumption the protocol refuses to let
 * anyone make — the get method is not promised to return more than the list did,
 * only allowed to.
 *
 * A host may wrap the one epic the way it wraps the list, so one level of
 * `epic` — or of the old `journey` — is unwrapped before reading.
 */
export function readEpicDetail(data: unknown): { epic: Epic } | { why: string } {
  for (const name of ['epic', 'journey']) {
    const wrapped = field(data, name)
    if (wrapped !== undefined) return readEpic(wrapped)
  }
  return readEpic(data)
}
