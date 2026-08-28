import type { ModuleContext } from 'roadmap-module-protocol'
import type { Territory } from '../../atlas/grouping.ts'
import { GET_EPIC, GOTO, LIST_EPICS } from '../../atlas/methods.ts'
import type { Reading } from '../../atlas/reading.ts'

/**
 * What was said, what was read, and what was not.
 *
 * Folded away by default, because none of it is what a reader came for. Present
 * at all, because every line of it is something this app decided about somebody
 * else's answer, and a decision made silently about data on screen is a decision
 * nobody can check.
 *
 * The specific failure this exists to prevent: a host answers with fifteen
 * entries, three of them are shaped in a way this app cannot read, and the page
 * draws twelve epics with complete confidence. Twelve is not wrong exactly — it
 * is what could be read — but a page that does not say so has silently become
 * the wrong answer to "what work exists", which is the only question it is for.
 */
export function Diagnostics({
  reading,
  territory,
  context,
}: {
  reading: Reading
  territory: Territory
  context: ModuleContext | null
}) {
  /**
   * Surplus fields, across every epic, counted once each. A host sending five
   * fields this app ignores is a host that knows more about its epics than this
   * map shows, and that is worth being able to see — it is the difference
   * between "the host has nothing else" and "this app draws nothing else".
   */
  const surplus = [...new Set(reading.epics.flatMap((epic) => epic.unread))].sort()

  return (
    <details className="rounded-md border p-3 text-xs">
      <summary className="text-muted-foreground cursor-pointer font-medium">
        What the host said, and what was read
      </summary>
      <dl className="text-muted-foreground mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono leading-relaxed">
        <dt>asked</dt>
        <dd className="break-all">{LIST_EPICS}</dd>

        <dt>answer</dt>
        <dd>
          {reading.shape === 'bare'
            ? 'a bare array'
            : `an object, with the list under "${reading.under}"`}
        </dd>

        <dt>entries</dt>
        <dd>
          {reading.offered} offered, {reading.epics.length} read
        </dd>

        <dt>projects</dt>
        <dd>{territory.projects.length}</dd>

        {reading.skipped.length > 0 ? (
          <>
            <dt className="text-destructive">skipped</dt>
            <dd className="text-destructive space-y-0.5">
              {reading.skipped.map((skip) => (
                <div key={`${skip.at}-${skip.why}`}>
                  #{skip.at}: {skip.why}
                </div>
              ))}
            </dd>
          </>
        ) : null}

        {surplus.length > 0 ? (
          <>
            <dt>not drawn</dt>
            <dd className="break-words">{surplus.join(', ')}</dd>
          </>
        ) : null}

        <dt>context</dt>
        <dd className="break-words">
          {context
            ? `epic ${context.epic ?? 'null'}, project ${context.project ?? 'null'}, theme ${context.theme}`
            : 'none heard'}
        </dd>

        <dt>can move</dt>
        <dd>{GOTO ?? 'no such method in this protocol'}</dd>
      </dl>

      {/*
        Notes about the conversation rather than about the answer. They are here
        rather than in a README because they explain something a person can see
        on the screen in front of them and would otherwise read as a bug.
      */}
      {territory.matchedNothing ? (
        <p className="text-muted-foreground mt-3 leading-relaxed text-pretty">
          The host says an epic is open and no epic on this map has that slug, so nothing is marked
          open. The two things the host said do not agree; the likeliest innocent cause is a list it
          filtered and a context it did not.
        </p>
      ) : null}

      <p className="text-muted-foreground mt-3 leading-relaxed text-pretty">
        Detail is read with <code>{GET_EPIC}</code> when it is needed. Every call this app makes is
        a question about the host&rsquo;s own material, or a request to move; it writes nothing
        anywhere and holds no credential.
      </p>
    </details>
  )
}
