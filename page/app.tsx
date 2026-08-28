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
 * maximum width, and the only thing that changes between a 220-pixel pane, a
 * sidebar and a full laptop window is how many epic cards sit in a row — one,
 * two, or three. Everything else, including the overview at the top, is the same
 * arrangement at every size.
 *
 * That is worth doing on purpose rather than by default. A module is framed in a
 * column whose width the module does not choose and cannot predict, so a layout
 * with two genuinely different modes has two modes the host can switch between by
 * dragging a divider, and a reader watching the page rearrange itself under their
 * hands is a reader who has lost their place. One arrangement that reflows is the
 * one that survives being embedded.
 *
 * ## Why the widths are asked of this element and not of the viewport
 *
 * `@container/page` here, and `@md/page:` and `@2xl/page:` on the things that
 * reflow, rather than `sm:` and `xl:`. The distinction is not decoration.
 *
 * A media query in a framed module is evaluated against the FRAME's viewport,
 * which is nearly right — it is the pane, not the host window — and wrong in the
 * one place it matters. This column is `max-w-5xl` with padding, so past about a
 * thousand pixels the pane keeps growing and the column does not. `xl:` fires at
 * a 1280-pixel viewport, by which time the grid has been stuck at 976 pixels for
 * a while: the third column arrived because of space the cards never got. Asking
 * this element how wide IT is makes the answer the same question a reader is
 * asking — is there room for another card here — and it keeps being the same
 * question if this page is ever nested a level deeper than a pane.
 *
 * The container is named. An unnamed `@container` is resolved to the nearest
 * ancestor that has one, and shadcn's `CardHeader` declares its own
 * (`@container/card-header`); a bare `@md:` inside a card would silently start
 * measuring the card header instead of the page and would be wrong only in the
 * layouts nobody looks at.
 *
 * ## Nothing on this page is clipped without a way back to it
 *
 * At 220 pixels every line of prose is narrower than several of the strings a
 * host can send, and there are only three honest things to do with a string too
 * long for its box: wrap it, scroll it inside its own box, or shorten it and say
 * what the whole of it was. Every place a host's words land does one of the
 * three, and the components say which and why. What none of them do is let a
 * long title push the page sideways: a body that scrolls horizontally hides the
 * right-hand edge of every other row on the page to make room for one of them.
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
    /*
      Two elements, and the split is the whole reason this works.
      `container-type: inline-size` sizes a query container from its own CONTENT
      box, and an element cannot query itself — so putting the container and the
      padding on one element gives you a circle the browser resolves by ignoring
      you: `@sm/page:p-5` on the container resolves against the container's own
      parent, which has none, so it never applies and the padding silently stays
      at its base value forever. It looked like it worked, because the columns —
      which are on a descendant — did.

      So: the outer element is the ruler, capped at the same `max-w-5xl` the
      column is capped at, and the inner one is the page. What every `@.../page`
      variant below is measuring is therefore the width the CONTENT has, which is
      the only width anything on this page should be deciding anything from.
    */
    <div className="@container/page mx-auto w-full max-w-5xl">
      <div className="space-y-5 p-3 @sm/page:space-y-6 @sm/page:p-5">
        <header className="space-y-1">
          {/*
            The type does not shrink with the pane, and that is a decision rather
            than an omission. Every other thing on this page gives up space at 220
            pixels — the padding, the bars, the third column — because none of them
            is the thing being read. Type is, and a narrow pane is if anything the
            place a reader is squinting hardest.
          */}
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
