import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { Project } from '../../atlas/grouping.ts'
import type { Travel } from '../../atlas/navigation.ts'
import { EpicCard } from './epic-card.tsx'

/**
 * How many epics a project shows before the rest are folded away.
 *
 * The brief this app was built to is specific: some projects hold one epic and
 * some hold fifteen, and a person should be able to take in the shape of the
 * whole thing without scrolling past ten screens of the largest one. A cap is
 * the only way to make the page's length depend on the number of PROJECTS
 * rather than on the number of epics, which is what "take in the shape of the
 * whole" actually requires.
 *
 * Six because it fills two rows at the widest layout and six at the narrowest,
 * so the folded state is a section rather than a stub in either. The count is
 * always on the heading whether the section is open or shut, so the cap changes
 * how much you scroll and never what you know.
 */
const SHOWN = 6

export function ProjectSection({
  project,
  anchor,
  here,
  reading,
  travelTo,
  lastTravel,
}: {
  project: Project
  /** The id this section answers to, so the overview above can jump to it. */
  anchor: string
  /** True when the host says the reader is standing in this project. */
  here: boolean
  /** The slug the host says is open, when it named one of these epics. */
  reading: string | null
  /** Ask the host to show an epic. Null when nothing can be asked; cards become articles. */
  travelTo: ((slug: string) => void) | null
  /** What became of the last press, wherever it was. Only the card it names shows it. */
  lastTravel: { slug: string; travel: Travel } | null
}) {
  const [open, setOpen] = useState(false)
  const first = project.epics.slice(0, SHOWN)
  const rest = project.epics.slice(SHOWN)

  return (
    <section id={anchor} className="scroll-mt-4">
      {/*
        The heading row wraps rather than shrinking. At 220 pixels a project name
        of any length and two badges do not fit on one line, and the two ways out
        are to wrap the badges under the name or to squeeze the name until it is
        an ellipsis. The name is what the row is for and the badges are two short
        constants, so the row wraps and the name keeps the whole first line.

        `min-w-0` on the heading and `basis-full` on nothing: with the name free
        to be narrow, a name that is one enormous word breaks inside itself
        instead of setting a floor for the flex row.
      */}
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3
          className={cn(
            'min-w-0 text-base font-semibold break-words',
            project.name === null && 'text-muted-foreground',
          )}
        >
          {/*
            A project with no name is not given one. "Uncategorised" and "Other"
            are both names for a project no host has, and inventing either would
            put a word on screen that does not appear anywhere in the answer.
          */}
          {project.name ?? 'Filed under no project'}
        </h3>
        <Badge variant="secondary" className="font-mono">
          {project.epics.length}
        </Badge>
        {here ? <Badge variant="outline">you are here</Badge> : null}
      </header>

      {project.name === null ? (
        <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
          The host named no project for these. They are here rather than folded into a neighbour,
          because which project an epic belongs to is something only the host can say.
        </p>
      ) : null}

      {/*
        A project the host put on the map by naming it in the context, with no
        epics in the answer. It is drawn, and it says why it is empty — the
        alternative is a project that appears to have lost its epics, or a
        project the reader is standing in that this map does not admit exists.
      */}
      {project.onlyFromContext ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs leading-relaxed">
          The host says the reader is in this project, and the answer it gave named no epics
          belonging to it. That is not an empty project — it is a project this app has been told
          about in one breath and not described in the other.
        </p>
      ) : null}

      {/*
        The columns are asked of the page's container, not of the viewport. See
        the essay in `app.tsx`; the short of it is that this grid is inside a
        `max-w-5xl` column, so past a thousand pixels the pane keeps growing and
        this grid does not, and a viewport breakpoint would add a third column on
        the strength of space these cards never receive.

        The thresholds are the width the CARDS need rather than round numbers. A
        card holding a title, a lede and a slug stops being worth reading below
        about 200 pixels, and the container is the column minus its own padding
        and the gaps — so two columns need `@md` (448) and three need `@2xl`
        (672), each of which leaves every card just over 200.
      */}
      {project.epics.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 @md/page:grid-cols-2 @2xl/page:grid-cols-3">
          {first.map((epic) => (
            <EpicCard
              key={epic.slug}
              epic={epic}
              open={epic.slug === reading}
              travelTo={travelTo}
              travel={lastTravel?.slug === epic.slug ? lastTravel.travel : null}
            />
          ))}
        </div>
      ) : null}

      {rest.length > 0 ? (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
          <CollapsibleContent className="grid grid-cols-1 gap-2 @md/page:grid-cols-2 @2xl/page:grid-cols-3">
            {rest.map((epic) => (
              <EpicCard
                key={epic.slug}
                epic={epic}
                open={epic.slug === reading}
                travelTo={travelTo}
                travel={lastTravel?.slug === epic.slug ? lastTravel.travel : null}
              />
            ))}
          </CollapsibleContent>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground mt-2">
              <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
              {open ? 'Show fewer' : `Show ${rest.length} more`}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      ) : null}
    </section>
  )
}
