import { type NavigationOutcome, navigationResult } from 'roadmap-module-protocol'
import type { Answer } from './connection.ts'

/**
 * Asking the host to show an epic.
 *
 * ## What this file used to be
 *
 * When this app was started there was no such thing. A module could send four
 * messages — `ready`, `request`, `resize`, `went` — and not one of them moved
 * anybody. The host could point a module at something; a module could point the
 * host at nothing. So a program showing every project and epic on the machine
 * could draw the whole map and never travel on it, and the honest design was a
 * page of cards that were deliberately not links plus a written account of the
 * message that would have to exist.
 *
 * `view.goto` is that message, and it arrived while this was being built. Two
 * things about its design are worth keeping in view here, because both change
 * what this file must do:
 *
 * **It is a method, not a ninth message.** So it rides `request`/`response`,
 * with the correlation and the timeout and the refusal envelope that already
 * exist. There is nothing new in `connection.ts` for it at all — it is
 * `ask('view.goto', …)`, and that is the point of having made it a method.
 *
 * **A refusal to move is `ok: true`.** This is the part that is easy to get
 * wrong and the reason this file exists rather than a line in the page. The
 * host understood the question, considered it, and answered no; that is a
 * successful call with the outcome `declined`. `ok: false` still means the call
 * did not happen — no such method, no such module, something broke — and
 * collapsing the two would leave this app unable to tell a host that refuses
 * from a host too old to have been asked. Those are exactly the two futures the
 * protocol's refusal design exists to keep apart, and they lead to different
 * screens: one says try again later, the other says this host cannot be asked
 * at all.
 */

/**
 * What became of one attempt to travel.
 *
 * The three protocol outcomes, plus the two things that can happen to the call
 * itself. Five, and they are five because each one leaves the reader somewhere
 * different:
 *
 * - `moved` — say nothing. The screen has already changed under them.
 * - `declined` — leave the row pressable. Trying again later is sensible.
 * - `no-such-target` — say so. A dead row is worth showing as dead, and
 *   pressing it again will not help.
 * - `cannot-ask` — this host does not answer the method. Nothing here will ever
 *   work, and the page should stop offering it rather than let somebody press a
 *   row that has no chance.
 * - `broke` — the call failed or timed out. Ordinary bad luck; pressable.
 */
export type Travel =
  | { outcome: NavigationOutcome; why: string; epic: string | null }
  | { outcome: 'cannot-ask'; why: string; epic: null }
  | { outcome: 'broke'; why: string; epic: null }

/** Whether a row that produced this outcome should still be pressable. */
export function worthPressingAgain(travel: Travel): boolean {
  return travel.outcome === 'declined' || travel.outcome === 'broke' || travel.outcome === 'moved'
}

/**
 * Read the answer to a `view.goto`.
 *
 * `navigationResult` is run over the data, and — unlike the epic material —
 * running it here is close to the whole job, because this answer is an OUTCOME
 * rather than a host's holdings. The protocol's own note on that distinction is
 * the argument: nothing about what a host keeps varies in "did you move", so
 * the shape is fixed and a host that answers outside it has answered something
 * this app genuinely cannot act on.
 *
 * Which is why an unparseable success becomes `broke` rather than an assumed
 * failure or an assumed move. Assuming it moved would leave this page marking a
 * row as open that the reader is not looking at; assuming it did not would
 * leave a person pressing a row that already worked.
 */
export function readTravel(answer: Answer): Travel {
  if (!answer.ok) {
    /**
     * `unknown-method` is the one refusal the protocol says an author should
     * treat as fatal: this host does not have this method and will not grow one
     * while the page is open. Everything else — `failed`, `unknown-module`, a
     * timeout — is bad luck, and bad luck is worth another press.
     */
    if (answer.reason === 'unknown-method') {
      return {
        outcome: 'cannot-ask',
        why: answer.error || 'this host does not answer the navigation method',
        epic: null,
      }
    }
    return { outcome: 'broke', why: answer.error || `the call did not complete: ${answer.reason}`, epic: null }
  }

  const parsed = navigationResult.safeParse(answer.data)
  if (!parsed.success) {
    return {
      outcome: 'broke',
      why: 'the host answered the navigation call with something that is not a navigation result',
      epic: null,
    }
  }
  return { outcome: parsed.data.outcome, why: parsed.data.why, epic: parsed.data.epic }
}

/**
 * The sentence a person reads after pressing a row.
 *
 * Empty for `moved`, and deliberately: the reader is now looking at the epic
 * they asked for, the screen said so by changing, and a line of text confirming
 * it would be this page narrating something already visible.
 *
 * The host's own `why` is preferred wherever it sent one, because it knows
 * things this app does not — which epic, which step, what its policy is — and a
 * generic sentence written here would be this app guessing at a reason on a
 * host's behalf. The fallbacks are for a host that sent the outcome and no
 * words.
 */
export function travelWords(travel: Travel): string {
  if (travel.outcome === 'moved') return ''
  if (travel.why) return travel.why
  switch (travel.outcome) {
  case 'declined':
    return 'The host understood and would rather not move right now.'
  case 'no-such-target':
    return 'The host looked and has nothing by that name.'
  case 'cannot-ask':
    return 'This host does not answer the method that asks it to move.'
  case 'broke':
    return 'The call did not complete.'
  }
}
