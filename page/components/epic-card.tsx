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
        {/*
          `min-w-0` and `break-words` together, and neither is enough alone. A
          flex item's floor is `min-content` unless it is told otherwise, so a
          title with one long word in it makes this heading refuse to be narrower
          than that word, which pushes the card past the section, the section past
          the column, and the column past the frame — at 220 pixels that is a page
          the reader has to scroll sideways to see the right edge of every row on.
          `min-w-0` lets the box get narrow; `break-words` lets the word do
          something other than stick out of it.
        */}
        <h4 className="min-w-0 text-sm leading-snug font-medium break-words text-pretty">
          {/*
            The slug when there is no title. Never "Untitled": the host did not
            say "untitled", it said nothing, and the slug is the one name this
            app actually has for the thing.

            `break-all` rather than `break-words` for this one. It is the only
            name on the card, so it may not be clipped and may not be shortened;
            and a slug is not prose, so there is nothing lost by breaking it
            mid-word where a narrow pane needs it broken.
          */}
          {epic.title ?? <span className="font-mono text-xs break-all">{epic.slug}</span>}
        </h4>
        {open ? (
          <Badge variant="default" className="shrink-0">
            open
          </Badge>
        ) : null}
      </div>

      {epic.lede ? (
        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed break-words text-pretty">
          {epic.lede}
        </p>
      ) : null}

      <div className="text-muted-foreground/70 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px]">
        {/*
          The slug under a title that already names the epic, so this is the one
          string on the card that may be shortened — and it is shortened with a
          `title` on it rather than clipped. The distinction the rest of this app
          draws between "there is nothing" and "nothing has told me" has a smaller
          cousin here: an ellipsis says there is more and where to get it, and a
          slug that simply stops at the edge of its box says the host's slug ends
          in the middle of a word.

          `min-w-0` for the same reason as the heading: without it the truncation
          never happens, because the box refuses to be narrower than the text it
          was going to truncate.
        */}
        {epic.title ? (
          <span className="min-w-0 truncate" title={epic.slug}>
            {epic.slug}
          </span>
        ) : null}
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
            // A sentence the host wrote, so it may contain anything, including
            // an epic slug long enough to be wider than a narrow pane.
            'mt-2 text-[11px] leading-relaxed break-words text-pretty',
            travel?.outcome === 'no-such-target' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {said}
        </p>
      ) : null}
    </>
  )

  /*
   * `min-w-0` on the card itself, because this element is a grid item and a grid
   * item's automatic minimum size is its min-content width. A card holding one
   * unbreakable forty-character word would otherwise widen its own grid column,
   * and a grid column is as wide as the page — so a single epic could make the
   * whole map scroll sideways from inside a `grid-cols-1`.
   */
  const shell = cn(
    'bg-card w-full min-w-0 rounded-lg border p-3 text-left transition-colors',
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
