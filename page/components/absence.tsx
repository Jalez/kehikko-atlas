import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type Situation, words } from '../../atlas/situation.ts'

/**
 * The screen for every state that is not a map.
 *
 * One component for all of them, because they differ only in their words and
 * the words live in `atlas/situation.ts`. A separate component per state would
 * mean the sentences drift apart in tone, and would make it possible to add a
 * state that renders without anybody having written a sentence for it.
 *
 * Nothing here spins, pulses or shimmers — not even in `asked`, which is the
 * one state that really is temporary. A loading animation is a promise that
 * something is about to arrive, and the only thing this app knows is that it
 * asked. If the host never answers, an animation would go on making that
 * promise forever.
 */
export function Absence({ situation, again }: { situation: Situation; again: (() => void) | null }) {
  const said = words(situation)

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-balance text-lg leading-snug">{said.headline}</CardTitle>
        <CardDescription className="sr-only">
          Why this is not the same as an empty roadmap
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-pretty text-sm leading-relaxed">{said.body}</p>

        {/*
          A refusal carries two things and both are shown. `reason` is the word
          from the protocol's closed set and it is already in the sentence above;
          `error` is the sentence a host wrote for whoever is writing the module,
          and it belongs in monospace, verbatim, uninterpreted. A page that
          summarised it would be standing between a developer and the only
          description of what they got wrong.
        */}
        {situation.kind === 'refused' && situation.error ? (
          <p className="bg-muted text-muted-foreground rounded-md p-3 font-mono text-xs leading-relaxed break-words">
            {situation.error}
          </p>
        ) : null}

        {again ? (
          <Button variant="outline" size="sm" onClick={again}>
            Ask again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
