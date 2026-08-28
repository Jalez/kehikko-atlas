import { type ReactNode, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  type Chosen,
  UNDESCRIBED_PROJECT,
  choosingDoes,
  openEpic,
  placeShown,
} from '../../atlas/chooser.ts'
import type { Project, Territory } from '../../atlas/grouping.ts'
import type { Epic } from '../../atlas/reading.ts'
import { type Travel, travelWords } from '../../atlas/navigation.ts'

/**
 * Atlas in a pane too narrow to hold a map: the projects, then one project's
 * epics, and the way back.
 *
 * The reasoning for the whole form — why a narrow pane gets something other than
 * a smaller map, and why this is a drill-down where it used to be two selects —
 * is in `atlas/chooser.ts`, with the measurements. What follows is only what the
 * drawing of it needs.
 *
 * ## Two screens, and a row is a name
 *
 * The rule for what a row may carry is what the verdict on the selects came down
 * to, and it is worth writing as a rule rather than as a description of today's
 * markup: **a row is a title, and beside it only what the host itself asserts
 * about that thing's state.** So a project row is a name and how many epics are
 * in it. An epic row is a title, the "open" marker where the host says this is
 * the one being read, and the step count where the host sent one. No lede, no
 * slug under the title, no sentence about what this screen is. Those are all
 * things the wide map draws, and drawing them here is what made the compact form
 * a smaller map rather than a different one.
 *
 * The slug is the exception that proves the rule: an epic whose host sent no
 * title has no other name, so the slug IS the title and is drawn as one. It is
 * never drawn under a title that already exists.
 *
 * ## The breadcrumb and the back button are both here on purpose
 *
 * They lead to the same screen and they are not the same thing. The crumb is
 * where you are — it is the only element on this form that names the project
 * whose epics these are, since the list itself is only titles — and the button
 * is how you leave. At this width the crumb is 12-pixel type, which is a fine
 * caption and a poor target; the button is a real one, with the height the rest
 * of this app's targets have.
 *
 * ## An absence that belongs here, and five that do not
 *
 * When the host has not answered, or refused, or answered something unreadable,
 * or answered and named no epics, this component is not on the page at all —
 * `app.tsx` draws `Absence` instead, at every width, in the words
 * `atlas/situation.ts` holds. That is deliberate rather than lazy: those five
 * screens differ ONLY in their wording, so a compact variant of them would be a
 * second set of sentences to keep in step with the first, and the first drift
 * between the two is the moment "the host has not answered" and "the host has no
 * epics" become the same screen in a narrow pane.
 *
 * The one absence that belongs here is about a project rather than about the
 * conversation: a project the host put on the map by saying the reader is in it,
 * whose epics its own answer never named. It is drawn where that project's epic
 * list would be, in the sentence the wide view uses, because the reader is
 * standing in that project and is owed an answer about it.
 */
export function Chooser({
  territory,
  travelTo,
  lastTravel,
  cannotTravelBecause,
  remembered,
  remember,
}: {
  territory: Territory
  /** Ask the host to show an epic. Null when nothing could possibly answer. */
  travelTo: ((slug: string) => void) | null
  /** What became of the last attempt, and which epic it was about. */
  lastTravel: { slug: string; travel: Travel } | null
  /** Why travel is impossible, when this app has been told a reason. */
  cannotTravelBecause: string | null
  /** Where the reader was standing last time, if the host kept it. */
  remembered: Chosen | null | undefined
  /** Ask the host to keep where they are now. Null when nothing can keep it. */
  remember: ((chosen: Chosen | null) => void) | null
}) {
  /**
   * One piece of state for the whole form, and it is the reader's navigation
   * rather than the screen.
   *
   * The two selects held two picks and had to clear one whenever the other
   * changed; a drill-down cannot get into that state, because there is no second
   * pick to go stale — an epic is not chosen here at all, it is pressed, and
   * pressing it asks the host rather than filling anything in. `placeShown`
   * turns this plus the territory into what is drawn, so the screen is a
   * function of one answer and one navigation, and there is nothing to keep in
   * step with anything.
   */
  const [chosen, setChosen] = useState<Chosen | null>(null)
  /**
   * Whether the drill-down has been settled, either by the host's memory or by
   * the reader's own hand.
   *
   * It exists because `chosen` has no value that means "not seeded yet" —
   * `null` is already taken, and it means something specific (the reader has
   * not navigated, so the host's standing decides). Without a second flag the
   * restore below would either be unable to restore `null`, or would keep
   * firing and stomp a reader who navigated before the greeting landed.
   *
   * Set by the reader's first press as well as by the restore, and that is the
   * important half: a greeting can arrive late, and a remembered place arriving
   * after somebody has already pressed Home would throw them back into the
   * project they had just left — the same bug the fix was for, running the
   * other way.
   */
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (settled || remembered === undefined) return
    setChosen(remembered)
    setSettled(true)
  }, [remembered, settled])

  /**
   * Every navigation in this component goes through here.
   *
   * One place, so that saving cannot be forgotten by a branch added later, and
   * so the settled flag cannot drift from the state it guards.
   */
  const choose = (next: Chosen | null) => {
    setChosen(next)
    setSettled(true)
    remember?.(next)
  }

  const place = placeShown(territory, chosen)
  const toProjects = () => choose({ at: 'projects' })

  return (
    <div className="space-y-3">
      {/*
        `text-xs` over shadcn's `text-sm`. The trail is not the content — the
        list under it is — and at 220 pixels a project name in 14-pixel type
        takes two of the lines the whole crumb is worth.
      */}
      <Breadcrumb>
        <BreadcrumbList className="gap-1 text-xs">
          <BreadcrumbItem>
            {place.at === 'projects' ? (
              /*
                At the top of the trail, Home is where you already are — so it
                is a page and not a link. A crumb that is pressable and goes
                nowhere is the same false affordance the epic cards refuse.
              */
              <BreadcrumbPage>Home</BreadcrumbPage>
            ) : (
              /*
                `asChild` over a button, because this crumb has no URL. An
                anchor with no `href` is neither focusable nor pressable by
                keyboard, and one with `href="#"` would push a fragment into the
                address bar of a page this app does not own.
              */
              <BreadcrumbLink asChild>
                <button
                  type="button"
                  className="cursor-pointer underline-offset-2 hover:underline"
                  onClick={toProjects}
                >
                  Home
                </button>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {place.at === 'epics' ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {/*
                  The project's name appears in exactly one place on this form,
                  so it may not be shortened away — it breaks instead, and the
                  crumb list wraps, so a long name takes a second line rather
                  than the pane's right edge.
                */}
                <BreadcrumbPage className="min-w-0 break-words">
                  {projectName(place.project)}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>

      {place.at === 'epics' ? (
        /*
          Below the breadcrumb, as a control rather than as a caption. `-ml-2`
          pulls the button's own padding back so the word "Projects" lines up
          with the crumb above it and the rows below it; a button indented by
          its own padding reads as belonging to neither.
        */
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2" onClick={toProjects}>
          <ChevronLeft />
          Projects
        </Button>
      ) : null}

      {place.at === 'projects' ? (
        <ul className="space-y-1">
          {territory.projects.map((project) => (
            <li key={project.name ?? ' unfiled'}>
              <Row onPress={() => choose({ at: 'epics', project: { name: project.name } })}>
                <span
                  className={cn(
                    'min-w-0 break-words',
                    project.name === null && 'text-muted-foreground italic',
                  )}
                >
                  {projectName(project)}
                </span>
                {/*
                  The count is the only thing beside a project name, and it is a
                  bare number in monospace rather than "6 epics": every row on
                  this screen is a project and every number on it is a count of
                  epics, so the word would be the same word on every line. The
                  word is on the `title` rather than gone: this app's rule is
                  that nothing a reader might need is dropped without a way back
                  to it, and a bare number is the one thing on this form whose
                  meaning is not written beside it.
                */}
                <span
                  className="text-muted-foreground ml-auto shrink-0 font-mono text-xs"
                  title={`${project.epics.length} ${project.epics.length === 1 ? 'epic' : 'epics'}`}
                >
                  {project.epics.length}
                </span>
                <ChevronRight className="text-muted-foreground/60 size-3.5 shrink-0" />
              </Row>
            </li>
          ))}
        </ul>
      ) : place.project.epics.length === 0 ? (
        /*
          The only empty project there can be: one the host named in its context
          and described no epics for. The words are shared with the wide view
          rather than written again here — see `atlas/chooser.ts`.
        */
        <div className="space-y-1.5 rounded-md border border-dashed p-3">
          <p className="text-sm leading-snug font-medium text-pretty">
            {UNDESCRIBED_PROJECT.headline}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
            {UNDESCRIBED_PROJECT.body}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-1">
            {place.project.epics.map((epic) => (
              <li key={epic.slug}>
                <EpicRow
                  epic={epic}
                  open={epic === openEpic(place.project, territory.reading)}
                  travelTo={travelTo}
                  /*
                    The one outcome a row does not repeat is `cannot-ask`,
                    because it is not about this epic — it is about the host,
                    it is sticky, and `choosingDoes` is already saying it in
                    the host's own words under the list. The wide map has no
                    such single place and so says it on the card that was
                    pressed; here that would be the same sentence twice, three
                    lines apart, on the screen this whole redesign exists to
                    quieten.
                  */
                  travel={
                    lastTravel?.slug === epic.slug && lastTravel.travel.outcome !== 'cannot-ask'
                      ? lastTravel.travel
                      : null
                  }
                />
              </li>
            ))}
          </ul>
          {/*
            Under the list, always, in all three of its versions. A list of
            names that quietly does nothing when pressed is worse than a
            disabled control, because nothing about it says it was pressed at
            all. See `choosingDoes`.
          */}
          <p className="text-muted-foreground text-xs leading-relaxed break-words text-pretty">
            {choosingDoes(travelTo !== null, cannotTravelBecause)}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * One epic, as a row.
 *
 * Pressable or inert and never something in between — the rule `epic-card.tsx`
 * argues at length for the wide map, applied at this width for the same reason:
 * a row that looks pressable and does nothing sends somebody hunting for a bug
 * instead of telling them the true and more useful thing, which is that there is
 * nobody here to ask.
 *
 * The marker is the host's and not this row's. Pressing asks; `roadmap.context`
 * says where the reader actually ended up; nothing here moves its own "open"
 * badge on the strength of having been pressed.
 */
function EpicRow({
  epic,
  open,
  travelTo,
  travel,
}: {
  epic: Epic
  open: boolean
  travelTo: ((slug: string) => void) | null
  travel: Travel | null
}) {
  const said = travel ? travelWords(travel) : ''

  return (
    <Row
      onPress={travelTo ? () => travelTo(epic.slug) : null}
      className={cn(open && 'border-primary/40 ring-primary/40 ring-1')}
      under={
        said ? (
          /*
            What the host said about the last press of this row. Nothing at all
            for a move that worked — the screen has already changed under them.
            It is the one sentence on this form that a host wrote, so it may be
            any length, and it breaks rather than being clipped.
          */
          <p
            className={cn(
              'text-[11px] leading-relaxed break-words text-pretty',
              travel?.outcome === 'no-such-target' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {said}
          </p>
        ) : null
      }
    >
      {/*
        The slug is the name when the host sent no title. Never "Untitled": the
        host did not say untitled, it said nothing. `break-all` on it because a
        slug is an identifier rather than prose, so nothing is lost by breaking
        one mid-word where a 220-pixel row needs it broken.
      */}
      <span className="min-w-0 break-words">
        {epic.title ?? <span className="font-mono text-xs break-all">{epic.slug}</span>}
      </span>
      {/*
        Size only where the host sent one, and as a bare number for the same
        reason the project counts are bare, with the word on the `title` for
        anybody who needs it — and a number here means steps where a number one
        screen up meant epics, which is exactly why it is recoverable. Nothing
        at all where the host said nothing: not "0 steps", not "—", not
        "unknown", because a dash reads as a value and a zero reads as a fact,
        and neither is one.
      */}
      {epic.size !== null ? (
        <span
          className="text-muted-foreground ml-auto shrink-0 font-mono text-xs"
          title={`${epic.size} ${epic.size === 1 ? 'step' : 'steps'}`}
        >
          {epic.size}
        </span>
      ) : null}
      {open ? (
        <Badge variant="default" className="ml-auto shrink-0 px-1.5 py-0 text-[10px]">
          open
        </Badge>
      ) : null}
    </Row>
  )
}

/**
 * The shape both lists share: a full-width row, its contents on one line, and
 * whatever that row has to say underneath.
 *
 * A `<button>` when there is something to do and a plain box when there is not.
 * `onPress` is nullable rather than absent so that the two are one decision made
 * by the caller, rather than two components somebody has to keep looking alike.
 *
 * `min-h-9` is not decoration. Every target on this page was measured at 220
 * pixels when the compact form was first built, and the floor that came out of
 * it is that nothing anybody has to aim at may be shorter than about 36 pixels.
 * A row whose title happens to be one short word would otherwise be 26.
 */
function Row({
  children,
  under,
  onPress,
  className,
}: {
  children: ReactNode
  under?: ReactNode
  onPress: (() => void) | null
  className?: string
}) {
  const body = (
    <>
      {/*
        `min-w-0` on this line and `break-words` on the name inside it, and
        neither is enough alone: a flex item's floor is its min-content width
        unless it is told otherwise, so one unbroken forty-character title would
        refuse to be narrower than itself and push the row, the list and the
        page past the right edge of a 220-pixel pane.
      */}
      <div className="flex w-full min-w-0 items-center gap-2">{children}</div>
      {under}
    </>
  )
  const shell = cn(
    'flex min-h-9 w-full min-w-0 flex-col justify-center gap-1 rounded-md border px-2.5 py-1.5',
    'text-left text-sm leading-snug',
    className,
  )

  if (!onPress) return <div className={shell}>{body}</div>

  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        shell,
        'hover:bg-accent focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      {body}
    </button>
  )
}

/**
 * What to call a project.
 *
 * A project with no name is not given one. "Uncategorised" and "Other" are both
 * names for a project no host has, and inventing either would put a word on
 * screen that appears nowhere in the answer. The wide map says "Filed under no
 * project" in a heading with room for it; at 220 pixels, in a row that also
 * carries a count, this is the same fact in the shorter words the select used
 * before it and the overview uses beside it.
 */
function projectName(project: Project): string {
  return project.name ?? 'no project named'
}
