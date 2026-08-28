import { Separator } from '@/components/ui/separator'
import { Absence } from './components/absence.tsx'
import { Chooser } from './components/chooser.tsx'
import { Diagnostics } from './components/diagnostics.tsx'
import { Overview } from './components/overview.tsx'
import { ProjectSection } from './components/project-section.tsx'
import { Travel } from './components/travel.tsx'
import { travelWords } from '../atlas/navigation.ts'
import { isFramed } from './attach.ts'
import { useAtlas } from './use-atlas.ts'

/**
 * Whether anything is framing this page, decided once.
 *
 * A window's parent does not change while a document is open — nothing
 * reparents a browsing context — so this is a fact rather than state, and
 * reading it once at module scope says so. A `useState` here would invite a
 * reader to wonder what makes it change.
 */
const FRAMED = isFramed()

/**
 * Atlas: what work exists, and how it is organised.
 *
 * ## One layout that reflows, and — under 300 pixels — a different answer
 *
 * From 300 pixels up there is no narrow build and no wide build. The page is a
 * single column with a maximum width, and the only thing that changes between a
 * sidebar and a full laptop window is how many epic cards sit in a row — one,
 * two, or three. That is worth doing on purpose: a module is framed in a column
 * whose width it does not choose and cannot predict, so a layout with two modes
 * has two modes the host can switch between by dragging a divider, and a reader
 * watching the page rearrange itself under their hands is a reader who has lost
 * their place. One arrangement that reflows is the one that survives being
 * embedded.
 *
 * Below 300 pixels that argument runs out, and the honest thing is to say so
 * rather than to keep reflowing something that has stopped working. A card is a
 * comparison device — it earns its title, lede and slug from being read against
 * its neighbours — and at 220 pixels there are no neighbours: one card to a row,
 * four in a 600-pixel pane, fifteen screens for one answer. Measured at that
 * width the lede runs 32 characters to the line, two thirds of the slugs are
 * shortened to an ellipsis, and the project headings stack onto two lines. So
 * under 300 the map is replaced by `Chooser`, which is a drill-down: the
 * projects, then the epics of the one you pick. Not a smaller map — a different
 * question, answered. It was two selects first, and what a select hides is its
 * list, so everything the list would have said had to be re-said in prose around
 * it; the reasoning, the replacement and the measurements are all in
 * `atlas/chooser.ts`.
 *
 * 300 rather than a round number, and rather than the 448 at which the grid
 * gains its second column, because 300 is where the measurements cross: at 295
 * and up the project heading — name, count, "you are here" — fits on one line
 * and the slugs stop being shortened; at 290 and below neither is true. Putting
 * the threshold at the two-column mark instead would have replaced a perfectly
 * good single-column map across the whole of 300 to 447.
 *
 * The switch is a container query like every other width decision here, so what
 * chooses between a map and a drill-down is the width of THIS COLUMN, not the
 * frame's viewport and not the window's. Both trees are in the document and one
 * of them is `display: none`, which keeps it out of the accessibility tree and
 * out of the tab order; the alternative — measuring the element in JavaScript
 * and rendering one — would make the layout depend on a `ResizeObserver` having
 * fired, and would draw the wrong one for a frame on first paint.
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
        {/*
          The name and the description, and ONLY when nothing is framing this
          page.

          They used to be here at every width, and the argument for that was
          that this is the only place the page says what Atlas is — including on
          the screens where there is no map, where somebody is reading a
          sentence about a host that did not answer and needs to know what was
          asking. That argument was right and is now wrong, for a reason outside
          this repository: the host prints the module's name on the pane header
          and its manifest `summary` as a tooltip on that name.

          Which covers the failure screens too, and that is the part worth
          noticing. The host's header is built from the MANIFEST, read on its own
          sweep, not from anything this page says — so it is there whether or not
          this page ever speaks. A silent module still has its name and its
          description on the pane around it.

          So framed, this was the name twice and a fixed strip of prose across
          the top of a pane that is often three hundred pixels tall, competing
          with the thing somebody opened the module to look at.

          Unframed it is still the only identity there is, so it stays there.
          `isFramed()` is a fact about this document that cannot change while it
          is open — nothing reparents a window — so it is read once rather than
          watched.
        */}
        {FRAMED ? null : (
          <header className="space-y-1">
            {/*
              The type does not shrink with the pane, and that is a decision
              rather than an omission. Every other thing on this page gives up
              space at 220 pixels — the padding, the bars, the third column —
              because none of them is the thing being read. Type is, and a narrow
              pane is if anything where a reader is squinting hardest.
            */}
            <h1 className="text-xl font-semibold tracking-tight">Atlas</h1>
            <p className="text-muted-foreground text-sm text-pretty">
              What work exists, and how it is organised: the projects, and the epics inside each of
              them.
            </p>
          </header>
        )}

        {situation.kind === 'mapped' && territory ? (
          <>
            {/*
              A drill-down, under 300 pixels of column. See the essay above and
              `atlas/chooser.ts`; the short of it is that this is not the map
              with things taken out, it is the other thing a map is for.
            */}
            <div className="@min-[300px]/page:hidden">
              <Chooser
                territory={territory}
                travelTo={travelTo}
                lastTravel={lastTravel}
                cannotTravelBecause={cannotTravelBecause}
              />
            </div>

            <div className="hidden space-y-5 @min-[300px]/page:block @sm/page:space-y-6">
              <p className="text-muted-foreground text-xs">
                {territory.epics} {territory.epics === 1 ? 'epic' : 'epics'} across{' '}
                {territory.projects.length}{' '}
                {territory.projects.length === 1 ? 'project' : 'projects'}, as the host describes
                them.
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
