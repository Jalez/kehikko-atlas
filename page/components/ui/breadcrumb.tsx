import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * shadcn's Breadcrumb, with two departures from what the CLI vendors.
 *
 * **`BreadcrumbEllipsis` is not here.** The trail this app draws is two crumbs
 * deep and cannot become three: there is a project list and there are the epics
 * of one project, and no third level exists to be folded away. Vendoring a
 * component for a case the data cannot reach would leave a future reader
 * wondering which screen elides its middle, and the answer would be none.
 * `Separator` in this directory was trimmed on the same argument, and says so.
 *
 * **The list's gap does not grow with the viewport.** shadcn's own list carries
 * `gap-1.5 sm:gap-2.5`, and `sm:` is a media query — evaluated, inside a framed
 * module, against the FRAME's viewport rather than against the column this
 * breadcrumb is in. Every other width decision in this app is asked of
 * `@container/page` for exactly that reason, and a breadcrumb that is only ever
 * drawn below 300 pixels of column would have had its gap decided by how wide
 * the host's window happens to be. It is one gap at every width instead; at this
 * size the difference was a pixel.
 *
 * What is NOT changed is that `BreadcrumbLink` takes `asChild`. The Home crumb
 * here is a button rather than an anchor — it goes nowhere a browser understands
 * and there is no URL for it to have — and `asChild` is how the shadcn component
 * lets a caller say so without this file growing an opinion about it.
 */
function Breadcrumb({ ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words',
        className,
      )}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  )
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'a'

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn('hover:text-foreground transition-colors', className)}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('text-foreground font-normal', className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
}
