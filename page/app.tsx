import { Separator } from '@/components/ui/separator'
import { Absence } from './components/absence.tsx'
import { Diagnostics } from './components/diagnostics.tsx'
import { Overview } from './components/overview.tsx'
import { ProjectSection } from './components/project-section.tsx'
import { Travel } from './components/travel.tsx'
import { travelWords } from '../atlas/navigation.ts'
import { useAtlas } from './use-atlas.ts'

/**
 * Atlas: what work exists, and how it is organised.
 *
 * ## One layout, three widths
 *
 * There is no narrow build and no wide build. The page is a single column with a
 * maximum width, and the only thing that changes between a phone-width frame, a
 * sidebar and a full laptop window is how many epic cards sit in a row — one,
 * two, or three. Everything else, including the overview at the top, is the same
 * arrangement at every size.
 *
 * That is worth doing on purpose rather than by default. A module is framed in a
 * column whose width the module does not choose and cannot predict, and the
 * media queries that decide the columns are evaluated against the FRAME's
 * viewport rather than the host page's — so a layout with two modes has two
 * modes the host can switch between by dragging a divider, and a reader watching
 * the page rearrange itself under their hands is a reader who has lost their
 * place. One arrangement that reflows is the one that survives being embedded.
 *
 * ## The order of the page
 *
 * The shape first, the detail second, the caveats last. Somebody opening this
 * wants to know how much there is before they want to know what any of it is
 * called, and the overview answers that in one screen no matter how many epics
 * there are. The travel note is at the bottom rather than the top because it is
 * the answer to a question a reader has not asked yet when the page loads — it
 * needs to be findable at the moment they try to press something, which is after
 * they have read some of the map.
 */
export function App() {
  const { situation, context, territory, again, travelTo, lastTravel } = useAtlas()

  /**
   * Why nothing is pressable, when nothing is.
   *
   * Three different reasons and they are different sentences, so the reason is
   * worked out here — where all three inputs are in scope — rather than guessed
   * at inside the component that draws it.
   */
  const cannotTravelBecause =
    travelTo !== null
      ? null
      : situation.kind === 'unframed'
        ? null // The component's own default sentence is right for this one.
        : lastTravel?.travel.outcome === 'cannot-ask'
          ? travelWords(lastTravel.travel)
          : null

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Atlas</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          What work exists, and how it is organised: the projects, and the epics inside each of
          them.
        </p>
      </header>

      {situation.kind === 'mapped' && territory ? (
        <>
          <p className="text-muted-foreground text-xs">
            {territory.epics} {territory.epics === 1 ? 'epic' : 'epics'} across{' '}
            {territory.projects.length}{' '}
            {territory.projects.length === 1 ? 'project' : 'projects'}, as the host describes them.
          </p>

          <Overview territory={territory} anchorFor={anchorFor} />

          <div className="space-y-8">
            {territory.projects.map((project, index) => (
              <ProjectSection
                key={project.name ?? ' unfiled'}
                project={project}
                anchor={anchorFor(index)}
                here={project.name !== null && project.name === territory.here}
                reading={territory.reading}
                travelTo={travelTo}
                lastTravel={lastTravel}
              />
            ))}
          </div>

          <Separator />
          <Travel canAsk={travelTo !== null} reason={cannotTravelBecause} />
          <Diagnostics reading={situation.reading} territory={territory} context={context} />
        </>
      ) : (
        <>
          <Absence situation={situation} again={again} />
          {/*
            The account of how travel works is shown even with no host. It is
            the most interesting true thing this app has to say about the
            protocol, it does not depend on there being any data, and somebody
            running this program on its own to see what it is should not have to
            arrange a host in order to find out what it can and cannot do.
          */}
          <Separator />
          <Travel canAsk={false} reason={cannotTravelBecause} />
        </>
      )}
    </div>
  )
}

/**
 * A section's anchor.
 *
 * By index, not by project name. A project name is a string a host chose and may
 * contain spaces, `#`, or anything else; using it as a fragment identifier would
 * make the overview's links depend on somebody else's punctuation. The index is
 * stable for as long as the answer is, which is exactly as long as the links
 * need to work.
 */
function anchorFor(index: number): string {
  return `project-${index}`
}
