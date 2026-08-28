import { MODULE_MESSAGES } from 'roadmap-module-protocol'
import { GOTO } from '../../atlas/methods.ts'

/**
 * What pressing a row does, and — where it does nothing — why.
 *
 * This section is the reason this app was written the way it was. For most of
 * its life the answer was "nothing, and nothing could", and the honest design
 * around that was: cards with no affordance, plus a written account of the
 * message that would have to exist. The message exists now. The account stays,
 * because a person reading a map still needs to know whether the rows are alive,
 * and because the shape of the thing that was missing is worth being able to
 * point at.
 */
export function Travel({ canAsk, reason }: { canAsk: boolean; reason: string | null }) {
  if (canAsk) {
    return (
      <section className="text-muted-foreground space-y-3 text-xs leading-relaxed">
        <h2 className="text-foreground text-sm font-semibold">What pressing a row does</h2>
        <p className="text-pretty">
          It asks the host, with <code className="font-mono">{GOTO}</code>, to show that epic — and
          the host decides. It may move, it may decline, or it may say there is nothing by that
          name; all three come back as a successful call with a different answer inside, and the
          card says which. Nothing on this page marks an epic as open on its own: the marker moves
          when <code className="font-mono">roadmap.context</code> says the reader moved, which is
          the only source for where anybody actually is.
        </p>
      </section>
    )
  }

  return (
    <section className="text-muted-foreground space-y-3 text-xs leading-relaxed">
      <h2 className="text-foreground text-sm font-semibold">Why nothing here opens</h2>

      <p className="text-pretty">
        {reason ??
          'There is no host to ask. Opened on its own, this page is a map with nothing on the other end of it, and a row that looked pressable would be promising something that cannot happen.'}
      </p>

      {GOTO === null ? (
        <p className="text-pretty">
          The protocol this app is built against names no method for asking a host to move. A module
          may send exactly {MODULE_MESSAGES.length} messages —{' '}
          {MODULE_MESSAGES.map((message, at) => (
            <span key={message}>
              {at > 0 ? ', ' : null}
              <code className="font-mono">{message}</code>
            </span>
          ))}{' '}
          — and not one of them says <em>take the reader to this epic</em>. The host can point a
          module at something; a module cannot point the host at anything. So this map can be read
          and not travelled on, and the alternatives are worse than the gap: a link to the host&rsquo;s
          own address for an epic cannot be built, because this app is never told what that address
          is, and if it could be, following it would break the page out of the frame it was put in.
        </p>
      ) : null}

      <details className="rounded-md border p-3">
        <summary className="text-foreground cursor-pointer text-xs font-medium">
          The shape of the ask, and what its answer has to carry
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-pretty">
            The protocol already had this in one direction:{' '}
            <code className="font-mono">roadmap.goto</code> asks a module to walk its reader
            somewhere, and <code className="font-mono">roadmap.went</code> answers whether the walk
            found anything. What was missing was the mirror.
          </p>
          <pre className="bg-muted overflow-x-auto rounded p-3 font-mono text-[11px] leading-relaxed">
            {`// the ask, module → host
{ epic?: string,   // which epic to show
  step?: number,   // 1-based, optional
  ref?:  string }  // a reference within it, optional

// the answer
{ outcome: 'moved' | 'declined' | 'no-such-target',
  epic:    string | null,   // where the reader ended up
  why:     string }         // a sentence, for the person`}
          </pre>
          <p className="text-pretty">
            The answer has to carry more than a boolean, for the same reason a refusal in this
            protocol carries both a word and a sentence: &ldquo;there is no such epic&rdquo; and
            &ldquo;I will not move right now&rdquo; are different futures. One row is dead and
            should say so; the other is worth pressing again in a minute.
          </p>
          <p className="text-pretty">
            And a declined move is a <em>successful call</em> with the answer no — not a failed
            one. Collapsing those would leave a module unable to tell a host that refuses from a
            host too old to have been asked, which are the two futures the whole refusal design
            exists to keep apart.
          </p>
        </div>
      </details>
    </section>
  )
}
