import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  type Picked,
  UNDESCRIBED_PROJECT,
  choosingDoes,
  epicShown,
  projectShown,
} from '../../atlas/chooser.ts'
import type { Territory } from '../../atlas/grouping.ts'
import { type Travel, travelWords } from '../../atlas/navigation.ts'

/**
 * Atlas in a pane too narrow to hold a map: a project, an epic, and the way out.
 *
 * The reasoning for the whole form is in `atlas/chooser.ts`, where the
 * arithmetic is; the short of it is that below three hundred pixels the card
 * grid stops being a comparison device and becomes fifteen screens of scrolling,
 * so this gives up browsing and keeps travel. What follows is only what the
 * drawing of it needs.
 *
 * ## The two absences this form can be in, and why neither is a disabled select
 *
 * A select with nothing in it and no explanation is exactly the failure this app
 * is built to avoid, so there is not one anywhere here. When the host has not
 * answered, or refused, or answered something unreadable, or answered and named
 * no epics, this component is not on the page at all — `app.tsx` draws
 * `Absence` instead, at every width, in the words `atlas/situation.ts` holds.
 * That is deliberate rather than lazy: those five screens differ ONLY in their
 * wording, so a compact variant of them would be a second set of sentences to
 * keep in step with the first, and the first drift between the two is the moment
 * "the host has not answered" and "the host has no epics" become the same
 * screen in a narrow pane.
 *
 * The one absence that belongs here is the one that is about a project rather
 * than about the conversation: a project the host put on the map by saying the
 * reader is in it, whose epics its own answer never named. That is drawn where
 * the epic select would be, in the sentence the wide view uses for it, because
 * the reader chose that project and is owed an answer about it.
 *
 * ## The essentials are below the selects and not inside them
 *
 * A select item shows a title and nothing else, which is the right amount for a
 * list somebody is scanning. What an epic actually is — the lede, the slug, how
 * big the host says it is — goes underneath, in a box that scrolls on its own.
 * Its own box rather than the page's, because in a pane 300 pixels tall a lede
 * of four lines would push the selects off the top of the frame, and the selects
 * are the reason anybody is looking at this.
 */
export function Chooser({
  territory,
  travelTo,
  lastTravel,
  cannotTravelBecause,
}: {
  territory: Territory
  /** Ask the host to show an epic. Null when nothing could possibly answer. */
  travelTo: ((slug: string) => void) | null
  /** What became of the last attempt, and which epic it was about. */
  lastTravel: { slug: string; travel: Travel } | null
  /** Why travel is impossible, when this app has been told a reason. */
  cannotTravelBecause: string | null
}) {
  /**
   * Two picks, held apart, and the epic's is cleared whenever the project's
   * changes.
   *
   * Keeping the epic pick would leave the two selects describing different
   * projects for exactly as long as it took the reader to notice, and
   * `epicShown` would resolve it to nothing anyway — so the clearing is not a
   * behaviour, it is this component refusing to hold a state it would then have
   * to explain.
   */
  const [pickedProject, setPickedProject] = useState<Picked | null>(null)
  const [pickedEpic, setPickedEpic] = useState<string | null>(null)

  const project = projectShown(territory, pickedProject)
  /*
   * Impossible, and drawn as nothing rather than as a sentence. A `mapped`
   * situation has at least one epic and every epic lands in some project, so a
   * territory with no projects does not exist — and writing a sentence for it
   * would be inventing a seventh absence for a state no host can produce, which
   * is the one thing `atlas/situation.ts` asks nobody to do.
   */
  if (!project) return null

  const at = territory.projects.indexOf(project)
  const epic = epicShown(project, territory.reading, pickedEpic)
  const travel = epic && lastTravel?.slug === epic.slug ? lastTravel.travel : null
  const said = travel ? travelWords(travel) : ''

  return (
    <div className="space-y-4">
      {/*
        Said once, plainly, because a reader who has seen this app in a wider
        pane will otherwise spend the first few seconds looking for the map. It
        is not an apology and not a "switch to full view" link — there is no such
        thing, the host owns the width — it is the fact.
      */}
      <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
        {territory.epics} {territory.epics === 1 ? 'epic' : 'epics'} across{' '}
        {territory.projects.length} {territory.projects.length === 1 ? 'project' : 'projects'}, as
        the host describes them. This pane is too narrow to lay them out as a map, so it offers the
        other thing a map is for: pick one and go there.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="atlas-project" className="text-xs font-medium">
          Project
        </label>
        <Select
          value={String(at)}
          onValueChange={(value) => {
            setPickedProject({ name: territory.projects[Number(value)]?.name ?? null })
            setPickedEpic(null)
          }}
        >
          <SelectTrigger id="atlas-project" className="w-full">
            <SelectValue />
          </SelectTrigger>
          {/*
            The open list is capped at the frame's width less the page's own
            padding. Radix already keeps a popper inside the viewport, but its
            floor is the trigger's width and its ceiling is the content's, and a
            project name a host sent at the protocol's full length would
            otherwise open a list wider than the pane and clipped by it.
          */}
          <SelectContent className="max-w-[calc(100vw-1.5rem)]">
            {territory.projects.map((each, index) => (
              <SelectItem key={each.name ?? ' unfiled'} value={String(index)}>
                {/*
                  The same words the overview uses for the group of epics the
                  host filed under nothing. Not "Other", not "Uncategorised":
                  no host has a project by either name.
                */}
                <span className={cn('min-w-0', each.name === null && 'text-muted-foreground italic')}>
                  {each.name ?? 'no project named'}
                </span>
                <span className="text-muted-foreground font-mono text-xs">{each.epics.length}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {project.epics.length === 0 ? (
        <div className="space-y-1.5 rounded-md border border-dashed p-3">
          <p className="text-sm leading-snug font-medium text-pretty">
            {UNDESCRIBED_PROJECT.headline}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
            {UNDESCRIBED_PROJECT.body}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="atlas-epic" className="text-xs font-medium">
            Epic
          </label>
          <Select
            value={epic?.slug ?? ''}
            onValueChange={(slug) => {
              setPickedEpic(slug)
              travelTo?.(slug)
            }}
          >
            <SelectTrigger id="atlas-epic" className="w-full">
              {/*
                The placeholder is a sentence about what has not happened yet,
                not a label. Nothing is chosen here on load — see
                `atlas/chooser.ts` — and "Epic" repeated inside the box would
                read as a value that failed to load.
              */}
              <SelectValue placeholder="None chosen" />
            </SelectTrigger>
            <SelectContent className="max-w-[calc(100vw-1.5rem)]">
              {project.epics.map((each) => (
                <SelectItem key={each.slug} value={each.slug}>
                  {/*
                    The slug when the host sent no title, in monospace, for the
                    same reason the card does it: the host did not say
                    "untitled", it said nothing, and the slug is the only name
                    this app has.
                  */}
                  {each.title ?? <span className="font-mono text-xs">{each.slug}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs leading-relaxed break-words text-pretty">
            {choosingDoes(travelTo !== null, cannotTravelBecause)}
          </p>
        </div>
      )}

      {/*
        The chosen epic, in its own scrolling box. `max-h-40` is a floor under
        the selects rather than a judgement about ledes: a host's lede can be
        two hundred words, and in a pane 300 pixels tall an unbounded one would
        push both selects out of the frame.
      */}
      {epic ? (
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
          <h2 className="min-w-0 text-sm leading-snug font-medium break-words text-pretty">
            {epic.title ?? <span className="font-mono text-xs break-all">{epic.slug}</span>}
          </h2>
          {epic.slug === territory.reading ? (
            <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
              The host says this is the one the reader is looking at.
            </p>
          ) : null}
          {epic.lede ? (
            <p className="text-muted-foreground text-xs leading-relaxed break-words text-pretty">
              {epic.lede}
            </p>
          ) : null}
          <div className="text-muted-foreground/70 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px]">
            {/*
              The slug breaks rather than being shortened. There is one epic in
              this box and all the width in the pane for it, so the trade the
              card makes — an ellipsis and a tooltip, to keep a row of cards
              lining up — buys nothing here.
            */}
            {epic.title ? <span className="min-w-0 break-all">{epic.slug}</span> : null}
            {epic.size !== null ? (
              <span className="whitespace-nowrap">
                {epic.size} {epic.size === 1 ? 'step' : 'steps'}
              </span>
            ) : null}
          </div>
          {/*
            What the host said about the last attempt to travel to this one.
            Nothing at all for a move that worked: the reader is looking at it.
          */}
          {said ? (
            <p
              className={cn(
                'text-[11px] leading-relaxed break-words text-pretty',
                travel?.outcome === 'no-such-target' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {said}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
