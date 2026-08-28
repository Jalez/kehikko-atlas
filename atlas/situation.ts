import type { Reading } from './reading.ts'
import { LIST_EPICS } from './methods.ts'

/**
 * What this app knows, how it came to know it, and the words for each answer.
 *
 * ## Why "nothing has told me" is a separate state from "there is nothing"
 *
 * Atlas holds no roadmap. It has no store, no seed, no cache; every project and
 * every epic it draws came out of a host's answer to one call. That makes the
 * empty screen the most dangerous screen in the app, because the same blank
 * space is the honest rendering of at least six different facts:
 *
 *   - the page was opened on its own and there is no host to ask;
 *   - a host is framing it and has not greeted it yet;
 *   - the greeting arrived, the question is out, the answer has not come back;
 *   - the host refused the question;
 *   - the host answered and the answer could not be read;
 *   - the host answered, and it genuinely has no epics.
 *
 * Only the last of those is about the work. The other five are about the
 * conversation, and a page that drew a spinner, or "No projects", or an empty
 * list for any of them would be telling a reader something false in a tone of
 * complete confidence. The protocol package's README makes the same distinction
 * one level up: a module that silently fails to appear is indistinguishable
 * from one that was never installed, so a host says which. This file is that
 * rule applied to what a module draws.
 *
 * The states are kept as data with their words attached, in one place, for two
 * reasons: so the page cannot draw a seventh state nobody wrote a sentence for,
 * and so the sentences can be tested for saying what they are supposed to say
 * rather than being buried in JSX where nothing can reach them.
 */

export type Situation =
  /** No host: `window.parent === window`. The page is running as its own program. */
  | { kind: 'unframed' }
  /** Framed, and `roadmap.hello` has not arrived. */
  | { kind: 'ungreeted' }
  /** Greeted; the question is in flight. */
  | { kind: 'asked' }
  /** The host answered `ok: false`. `reason` is a word from the protocol's closed set. */
  | { kind: 'refused'; reason: string; error: string }
  /** No answer inside this app's own patience. The word is Atlas's, not the protocol's. */
  | { kind: 'unanswered'; after: number }
  /** An answer arrived and nothing in it could be read as an epic. */
  | { kind: 'unreadable'; reading: Reading }
  /** The host answered, and named no epics. The only state here that is about the work. */
  | { kind: 'none' }
  /** There is a map. */
  | { kind: 'mapped'; reading: Reading }

export interface Words {
  /** The line in large type. A fact, not a status. */
  headline: string
  /** Why that fact is not the same as "there is no work". */
  body: string
}

/**
 * The sentences.
 *
 * Written out in full rather than composed from fragments, because the
 * difference between these screens is entirely in the wording, and a template
 * that shared a clause between two of them would be a template that makes them
 * look like the same screen with a variable in it. They are not.
 *
 * The method name is interpolated rather than written, because it is resolved
 * from the protocol package at startup and this app must not print a spelling
 * it did not actually use — a sentence naming a call that was never made is a
 * sentence that sends somebody debugging in the wrong direction.
 */
export function words(situation: Situation): Words {
  switch (situation.kind) {
  case 'unframed':
    return {
      headline: 'Nothing has told this app anything.',
      body:
          'Atlas holds no roadmap of its own. It keeps no copy, reads no repository and talks to no tracker — it draws what a host answers, and this page was opened on its own, so nothing has been asked and nothing has answered. What you are looking at is not a roadmap with no projects in it. It is a roadmap nobody has described yet.',
    }
  case 'ungreeted':
    return {
      headline: 'Something is framing this page and has not said hello.',
      body:
          'A host is on the other side of this frame. Until its greeting arrives, Atlas has not been told which epics exist — and has not been told that none do. From here those two look identical, and only one of them is about the work.',
    }
  case 'asked':
    return {
      headline: 'The question is out.',
      body: `Atlas has asked the host for ${LIST_EPICS} and the answer has not come back yet. Nothing is drawn because nothing has been said, not because there is nothing to draw.`,
    }
  case 'refused':
    return {
      headline: 'The host was asked, and refused.',
      body: `Atlas asked the host for ${LIST_EPICS} and was refused: ${situation.reason}. That is an answer about the question and not about the work — how many projects and epics exist is still something nothing has told this app.`,
    }
  case 'unanswered':
    return {
      headline: 'The host was asked, and has not answered.',
      body: `Atlas asked the host for ${LIST_EPICS} and stopped waiting after ${Math.round(situation.after / 1000)} seconds. The host may yet reply. Nothing on this side can tell a host that is slow from a host that will never answer, so this app says it gave up rather than leaving a page that looks like it is still loading.`,
    }
  case 'unreadable':
    return {
      headline: 'The host answered, and Atlas could not read the answer.',
      body: `${LIST_EPICS} came back and nothing in it could be read as an epic. The protocol fixes the question and deliberately not the shape of the answer, so this is two programs disagreeing about form. It is not a report that there is no work.`,
    }
  case 'none':
    return {
      headline: 'The host answered: it has no epics yet.',
      body:
          'This is the one screen in this app that really does mean there is nothing. Atlas asked which epics exist, the host answered, and it named none. An empty roadmap is a roadmap somebody has described.',
    }
  case 'mapped':
    return {
      headline: 'The host answered.',
      body: `Every project and epic below came out of one call to ${LIST_EPICS}.`,
    }
  }
}

/**
 * Which situation an answer puts this app in.
 *
 * Three outcomes out of one successful response, and keeping them apart is the
 * entire point of the function: an unreadable answer is not an empty one, and an
 * empty one is not a failure. A single `if (!epics.length)` would collapse all
 * three into the screen that says there is no work.
 */
export function situationOf(reading: Reading): Situation {
  if (reading.shape === 'unrecognised') return { kind: 'unreadable', reading }
  if (reading.epics.length === 0) {
    /**
     * An answer that offered entries and yielded none is unreadable, not empty.
     * The host clearly has something; this app could not read any of it, and
     * saying "no epics yet" here would be blaming the roadmap for a failure on
     * this side of the frame.
     */
    return reading.offered > 0 ? { kind: 'unreadable', reading } : { kind: 'none' }
  }
  return { kind: 'mapped', reading }
}
