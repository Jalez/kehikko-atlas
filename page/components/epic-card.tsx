import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { type Travel, travelWords } from '../../atlas/navigation.ts'
import type { Epic } from '../../atlas/reading.ts'

/**
 * One epic.
 *
 * ## Pressable, or an article, and never something in between
 *
 * A reader looking at a map of epics wants to open one, and for most of this
 * app's life there was no way to let them: a module could send `ready`,
 * `request`, `resize` and `went`, and none of them says "take the reader here".
 * The card was an `<article>` with no affordance at all, on the principle that a
 * false affordance is worse than an absent one — somebody presses it, nothing
 * happens, and what they conclude is that this page is broken, which sends them
 * hunting for a bug instead of learning the true and more useful fact.
 *
 * `view.goto` exists now, so the card can be a button. The principle did not
 * change; it just has a second branch. When there is nobody to ask — no host, or
 * a host that does not answer the method — this renders exactly what it always
 * rendered, an article with no hover, no cursor and no press, and the page says
 * why in words somewhere a reader will find them.
 *
 * The one thing it never does is move its own marker. Pressing this asks; the
 * host answers; `roadmap.context` says where the reader actually ended up. A
 * card that highlighted itself on the acknowledgement would be drawing where it
 * asked to be rather than where anybody is.
 */
export function EpicCard({
  epic,
  open,
  travelTo,
  travel,
}: {
  epic: Epic
  open: boolean
  /** Null when nothing can be asked. The card becomes an article. */
  travelTo: ((slug: string) => void) | null
  /** What happened the last time this particular epic was pressed. */
  travel: Travel | null
}) {
  const said = travel ? travelWords(travel) : ''
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm leading-snug font-medium text-pretty">
          {/*
            The slug when there is no title. Never "Untitled": the host did not
            say "untitled", it said nothing, and the slug is the one name this
            app actually has for the thing.
          */}
          {epic.title ?? <span className="font-mono text-xs">{epic.slug}</span>}
        </h4>
        {open ? (
          <Badge variant="default" className="shrink-0">
            open
          </Badge>
        ) : null}
      </div>

      {epic.lede ? (
        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed text-pretty">
          {epic.lede}
        </p>
      ) : null}

      <div className="text-muted-foreground/70 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px]">
        {epic.title ? <span className="truncate">{epic.slug}</span> : null}
        {/*
          Size is drawn only when the host said one. An epic whose size is
          unknown shows nothing here — not "0 steps", not "—", not "unknown".
          A dash reads as a value and zero reads as a fact, and neither is one.
        */}
        {epic.size !== null ? (
          <span className="whitespace-nowrap">
            {epic.size} {epic.size === 1 ? 'step' : 'steps'}
          </span>
        ) : null}
      </div>

      {/*
        What the host said about the last press of this card. Nothing at all for
        a move that worked: the screen changed, and a line confirming it would be
        this page narrating something already visible.
      */}
      {said ? (
        <p
          className={cn(
            'mt-2 text-[11px] leading-relaxed text-pretty',
            travel?.outcome === 'no-such-target' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {said}
        </p>
      ) : null}
    </>
  )

  const shell = cn(
    'bg-card w-full rounded-lg border p-3 text-left transition-colors',
    open && 'ring-primary/40 border-primary/40 ring-2',
  )

  if (!travelTo) return <article className={shell}>{body}</article>

  return (
    <button
      type="button"
      onClick={() => travelTo(epic.slug)}
      className={cn(
        shell,
        'hover:bg-accent focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      {body}
    </button>
  )
}
