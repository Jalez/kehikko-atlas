import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { type Chosen, choosingDoes, openEpic } from '../../atlas/chooser.ts'
import type { Territory } from '../../atlas/grouping.ts'
import type { Travel } from '../../atlas/navigation.ts'
import {
  epicLabel,
  epicPrompt,
  openEpicValue,
  pickedProject,
  projectLabel,
  projectNamed,
  projectValue,
  stripNews,
} from '../../atlas/strip.ts'

/**
 * Atlas in a pane with no height: a project picker and an epic picker, beside
 * each other.
 *
 * The reasoning for the whole form — why a short pane gets neither the map nor
 * the drill-down, and why a select is safe here when it was not before — is in
 * `atlas/strip.ts`, with the measurements. What follows is only what the
 * drawing of it needs.
 *
 * ## Two ways to draw two pickers, and the width that chooses between them
 *
 * Both are here and CSS picks one, the same way the page picks between the map
 * and the drill-down and for the same reason: measuring in JavaScript would
 * make the layout wait on a `ResizeObserver` and draw the wrong one on a
 * frame's first paint.
 *
 * **Under 420 pixels of column: two selects.** A select is the smallest control
 * that answers "take me to the one I am thinking of". It shows one value and
 * draws its list OVER the page, which is the property that matters in a box 110
 * pixels tall — the list does not have to fit in the strip, only the trigger
 * does, and Radix bounds the open list by the frame through
 * `--radix-select-content-available-height`. Measured, the pair is 44 pixels of
 * page at every width it is drawn at, from 220 up, and its open list stays
 * inside a 120-pixel frame rather than running off the bottom of it.
 *
 * **From 420 up: the lists themselves, as rows of pressable items.** Everything
 * that fits is visible at once, which a select can never be, and picking costs
 * one gesture instead of two. This is the default and the selects are the
 * fallback, not the other way round: the whole reason a short pane is a
 * different layout is that it has width to spend, and a control that hides its
 * list spends none of it.
 *
 * 420 is measured rather than chosen, and it is measured on the PROJECT row.
 * That is the decision worth arguing: it is the row whose length is bounded by
 * something — how many projects a person has — where the epic row's length is
 * bounded by nothing, so a threshold set from the epics would sit wherever the
 * largest project happened to be and would move when somebody wrote another
 * epic. A row of projects that has wrapped onto two rows of projects has spent
 * exactly the height this layout exists to save; a row of epics that wraps has
 * only used the width it was given.
 *
 * The number: against the harness's ordinary roadmap — five projects, names of
 * 5 to 9 characters — the items measure 51, 60, 66, 72 and 83 pixels, so with
 * their gaps the row is 348 wide, and with the 48-pixel label, its gap and the
 * strip's padding it needs exactly 420. Measured at 410 the row is on two lines
 * and at 420 it is on one, which is the crossing this threshold is.
 *
 * What the lists cost in height, measured against a nine-epic project rather
 * than guessed at: 80 pixels where the epic row fits on one line, 116 where it
 * wraps to two. So all nine epics are visible at 1200×120 and at 1600×120 on a
 * single line, all nine at 700×120 and at 900×130, and seven of nine at 900×110
 * — the shape this layout was written for — with the last two one small drag
 * away.
 *
 * That last is a bound nothing can lift, and it is worth being plain about
 * rather than rounding up to "it fits". A project may hold fifty epics; fifty
 * names do not go in 110 pixels at any width, and the three things a layout can
 * do about it are scroll them, clip them silently, or replace them with a
 * count. The second is the one this app refuses everywhere else — nothing is
 * clipped without a way back to it — and the third is what the select already
 * is, drawn worse. So: they scroll, and the row that says WHICH project they
 * belong to is pinned above them so it cannot scroll away with them.
 *
 * ## Nothing here holds a second pick
 *
 * The project picker's value is the page's `chosen`. The epic picker's value is
 * `openEpic` — what the HOST says is open — and choosing an epic does not set
 * it, it asks the host to move. So the pair cannot get into the state the first
 * build of this app did, where two held picks had to be cleared against each
 * other. See `atlas/strip.ts`.
 *
 * ## Why this fits, mechanically
 *
 * The strip is `max-h-[100dvh]`; inside it the projects row is pinned, the epic
 * row is the one `min-h-0 flex-1 overflow-y-auto` box, and any line the host
 * gave sits under both. That is three separate promises:
 *
 * - The page can never be taller than the pane, so there is no vertical page
 *   overflow at any height — which is the entire point of this layout, and the
 *   thing a strip that merely reflowed would fail at.
 * - A reader who pressed something cannot scroll away from the host's answer to
 *   it, and a reader scrolling for a ninth epic cannot lose the row that says
 *   which project those epics belong to.
 * - `page/attach.ts` reports this page's height to the host, and some hosts
 *   grow the pane to it. Capped at the viewport, the reported height can only
 *   ever be at most the pane, so a host that grows to it cannot grow the pane
 *   past the threshold that chose this layout. An uncapped strip could: it
 *   would report a height taller than the pane, be given it, stop being short,
 *   redraw as a map, report 2000 pixels, and the reader would watch the module
 *   climb out of its own strip.
 */
export function Strip({
  territory,
  travelTo,
  lastTravel,
  cannotTravelBecause,
  chosen,
  choose,
}: {
  territory: Territory
  /** Ask the host to show an epic. Null when nothing could possibly answer. */
  travelTo: ((slug: string) => void) | null
  /** What became of the last attempt, and which epic it was about. */
  lastTravel: { slug: string; travel: Travel } | null
  /** Why travel is impossible, when this app has been told a reason. */
  cannotTravelBecause: string | null
  /** Where the reader has navigated. Held by the page — see `page/place.ts`. */
  chosen: Chosen | null
  /** Navigate. The only way to move, and it saves. */
  choose: (next: Chosen | null) => void
}) {
  const project = pickedProject(territory, chosen)
  const epics = project?.epics ?? []
  const open = project ? openEpic(project, territory.reading) : null
  /**
   * What pressing an epic does, in the words every other form on this page uses
   * — carried on `title` and `aria-label` rather than drawn as a line.
   *
   * The full argument is on `stripNews`. The short of it is that this sentence
   * costs a sixth of a 120-pixel pane, permanently, to say the same thing on
   * every visit, and what the rule requiring it is protecting — that nobody
   * presses something which silently does nothing — is already guaranteed here
   * by the items being inert text rather than buttons when there is nothing to
   * ask.
   */
  const standing = choosingDoes(travelTo !== null, cannotTravelBecause)
  /**
   * And what the host said about an actual attempt, which does get a line,
   * because it is the answer to a question the reader just asked by pressing
   * something. Null almost always, and then nothing is drawn at all.
   */
  const news = stripNews(
    lastTravel && lastTravel.travel.outcome !== 'cannot-ask' ? lastTravel.travel : null,
  )
  /*
    A failed move is the one sentence here that is bad news, and the only one
    coloured. `declined` is not: the host understood and would rather not, which
    is an answer rather than a fault.
  */
  const wrong = lastTravel?.travel.outcome === 'no-such-target'

  /**
   * A project picked, by whichever of the two forms did the picking.
   *
   * A value this app did not write is dropped rather than guessed at. Nothing
   * can send one today; the select's items are built from the same function
   * that reads them back. It costs a line and it means the one way into this
   * state is the one the encoding describes.
   */
  const pickProject = (value: string) => {
    const name = projectNamed(value)
    if (name === undefined) return
    choose({ at: 'epics', project: { name } })
  }

  const pickEpic = (slug: string) => travelTo?.(slug)

  return (
    /*
      `py-1.5` rather than the `p-3` the rest of the page uses. Twelve pixels of
      vertical padding instead of twenty-four is twelve pixels back into a
      budget of a hundred and twenty, which is most of the difference between a
      second row of epics and half of one.
    */
    <div data-layout="strip" className="flex max-h-[100dvh] flex-col gap-1 px-2 py-1.5">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/*
          Under 480 pixels: two selects. `min-w-0` on both the row and each
          control, because a select trigger carries `whitespace-nowrap` and a
          flex item's floor is its own min-content width unless it is told
          otherwise — without it one long project name would refuse to be
          narrower than itself and push the strip sideways.
        */}
        <div data-pickers="selects" className="flex min-w-0 gap-2 @min-[420px]/page:hidden">
          <Select
            value={project ? projectValue(project.name) : undefined}
            onValueChange={pickProject}
          >
            <SelectTrigger
              size="sm"
              aria-label="Project"
              className="w-full min-w-0 flex-1 overflow-hidden"
            >
              <SelectValue placeholder="Pick a project" />
            </SelectTrigger>
            <SelectContent>
              {territory.projects.map((each) => (
                <SelectItem key={each.name ?? ' unfiled'} value={projectValue(each.name)}>
                  {projectLabel(each)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/*
            Disabled where there is nothing to pick or nobody to ask, rather
            than pressable and inert. The same rule the cards and the rows
            follow: a control that looks alive and does nothing sends somebody
            hunting for a bug instead of telling them there is nobody here.
            The sentence underneath says which of the reasons it is.
          */}
          <Select
            value={openEpicValue(project, territory.reading)}
            onValueChange={pickEpic}
            disabled={travelTo === null || epics.length === 0}
          >
            <SelectTrigger
              size="sm"
              aria-label="Epic"
              /*
                The same sentence the items carry, for the same reason and by
                the same means: on the control, not under the list. See
                `atlas/strip.ts`.
              */
              title={standing}
              className="w-full min-w-0 flex-1 overflow-hidden"
            >
              <SelectValue placeholder={epicPrompt(project)} />
            </SelectTrigger>
            <SelectContent>
              {epics.map((epic) => (
                <SelectItem key={epic.slug} value={epic.slug}>
                  {epicLabel(epic)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/*
          From 480 up: the lists, in the open. Two labelled rows that wrap,
          which is the arrangement that uses width instead of height.

          The PROJECTS row is pinned and only the epics scroll, which is worth
          saying because the obvious thing — one scroll box around both — was
          what this did first and it was wrong in a way that only shows up in a
          110-pixel pane. Scrolling to reach a ninth epic took the project row
          off the top of the strip, so the reader lost the control that says
          which project those epics belong to at exactly the moment they were
          reading them. A parent control does not scroll away from its own list.
        */}
        <div
          data-pickers="lists"
          className="hidden min-h-0 min-w-0 flex-col gap-1 @min-[420px]/page:flex"
        >
          <Line label="Projects" className="shrink-0">
            {territory.projects.map((each) => (
              <Item
                key={each.name ?? ' unfiled'}
                onPress={() => choose({ at: 'epics', project: { name: each.name } })}
                /*
                  `aria-pressed` rather than a colour alone: this row is a set
                  of toggles over one value, and which one is on is the only
                  thing telling a reader why the epic row says what it says.
                */
                pressed={project !== null && project.name === each.name}
                muted={each.name === null}
              >
                {projectLabel(each)}
              </Item>
            ))}
          </Line>
          {/*
            The epic row is the one that scrolls, because it is the one whose
            length nothing bounds: a project may hold three epics or fifty, and
            no arrangement makes fifty names fit in 110 pixels. What it must not
            do is CLIP them without saying so, which is why this is a scroll box
            and not an overflow-hidden one with a count beside it.
          */}
          <Line label="Epics" className="min-h-0 flex-1 overflow-y-auto">
            {project === null || epics.length === 0 ? (
              /*
                Not a disabled item and not an empty row. An empty row is a row
                the reader cannot tell from one that has not loaded, and the
                three reasons it can be empty are three different facts — see
                `epicPrompt`.
              */
              <span className="text-muted-foreground self-center text-xs">
                {epicPrompt(project)}
              </span>
            ) : (
              epics.map((epic) => (
                <Item
                  key={epic.slug}
                  onPress={travelTo ? () => pickEpic(epic.slug) : null}
                  /*
                    The marker is the host's. `aria-current="page"` rather than
                    `aria-pressed`, because this is not a toggle the reader set
                    — it is where the canvas is standing, and it moves when
                    `roadmap.context` says the reader moved and at no other
                    time.
                  */
                  current={open !== null && open.slug === epic.slug}
                  /*
                    An epic with no title is named by its slug, which is an
                    identifier rather than prose, so it is drawn as one.
                  */
                  mono={epic.title === null}
                  /*
                    What pressing this does, on the item rather than under the
                    list. It is the same sentence the drill-down draws in prose
                    and it costs no height here — see `atlas/strip.ts`.
                  */
                  says={standing}
                >
                  {epicLabel(epic)}
                </Item>
              ))
            )}
          </Line>
        </div>
      </div>

      {/*
        Only when the host has answered an attempt, and no element at all
        otherwise — not an empty `<p>`, which would hold its line-height open
        for a sentence that is not there and spend the height anyway.

        Outside the scrolling box, so a reader who pressed something cannot
        scroll away from the answer. `aria-live`, because it appears in response
        to a press rather than to a navigation: without it a screen reader would
        announce nothing at all when a host declined, which is precisely the
        silence the drill-down's standing sentence exists to prevent.

        It clamps rather than wraps, because a host's refusal can be a paragraph
        and this strip has one line to spend; the whole of it is on the `title`,
        which is the same bargain the counts in the drill-down make.
      */}
      {news === null ? null : (
        <p
          title={news}
          aria-live="polite"
          className={cn(
            'shrink-0 truncate text-[11px] leading-tight',
            wrong ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {news}
        </p>
      )}
    </div>
  )
}

/**
 * One labelled row of items.
 *
 * The label is fixed-width and outside the wrapping box, so the two rows line
 * up with each other rather than each starting wherever its own word ended. It
 * is 12-pixel type and not a control — the items are the controls — so it is
 * `aria-hidden` from the list and named on the list instead, which is what a
 * screen reader can act on.
 */
function Line({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-start gap-2', className)}>
      <span
        aria-hidden
        className="text-muted-foreground sticky top-0 w-12 shrink-0 pt-1.5 text-right text-[11px] leading-tight"
      >
        {label}
      </span>
      <div aria-label={label} role="group" className="flex min-w-0 flex-wrap gap-1">
        {children}
      </div>
    </div>
  )
}

/**
 * One pressable name.
 *
 * `min-h-8` rather than the `min-h-9` the drill-down's rows use, and the
 * difference is measured rather than eyeballed: 36 pixels is the floor for a
 * full-width row in a 220-pixel column, where a row is the only thing on its
 * line and the reader is aiming down a list. Here the items sit in a row and
 * are aimed at sideways, where the width of the target is what a pointer has to
 * find and the height is nearly free — and the two rows of them have to fit,
 * with a label and a sentence, inside 110 pixels. 32 is shadcn's own small
 * control height, which is what the selects beside them are.
 *
 * Inert rather than pressable where there is nobody to ask, for the reason
 * `epic-card.tsx` argues at length: a dead control that looks alive is worse
 * than one that says it is dead.
 */
function Item({
  children,
  onPress,
  pressed,
  current,
  muted,
  mono,
  says,
}: {
  children: ReactNode
  onPress?: (() => void) | null
  pressed?: boolean
  current?: boolean
  muted?: boolean
  mono?: boolean
  /**
   * What pressing this does, for a reader who wants to know before they press.
   *
   * On the control rather than under the list, which is the short form's whole
   * departure from the drill-down and is argued in `atlas/strip.ts`. Both
   * attributes and not one: `title` is the hover, `aria-label` is the screen
   * reader, and an `aria-label` that replaced the name would lose the name, so
   * it carries the name and the sentence together.
   */
  says?: string
}) {
  const shell = cn(
    'flex min-h-8 max-w-full min-w-0 items-center rounded-md border px-2 text-xs leading-tight',
    /*
      `break-words` and not `truncate`. Nothing on this page is clipped without
      a way back to it, and an item is its whole name — there is no second place
      on this form where a project or an epic is written out.
    */
    'break-words',
    muted && 'text-muted-foreground italic',
    mono && 'font-mono',
    pressed && 'bg-accent border-primary/40 text-accent-foreground',
    current && 'border-primary/40 ring-primary/40 ring-1',
  )

  const named = typeof children === 'string' ? children : undefined
  const told = says && named ? `${named} — ${says}` : undefined

  if (!onPress) {
    return (
      <span
        data-chip
        className={shell}
        title={says}
        aria-label={told}
        aria-current={current ? 'page' : undefined}
      >
        {children}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-chip
      onClick={onPress}
      title={says}
      aria-label={told}
      aria-pressed={pressed}
      aria-current={current ? 'page' : undefined}
      className={cn(
        shell,
        'hover:bg-accent focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      {children}
    </button>
  )
}
