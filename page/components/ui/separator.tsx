import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * shadcn's Separator, with `decorative` handled here rather than by Radix.
 *
 * The component the CLI vendors wraps `@radix-ui/react-separator`, whose entire
 * contribution is choosing between `role="separator"` and `role="none"` and
 * setting an orientation attribute. Every separator in this app divides a list
 * a screen reader already navigates by its headings, so it is decorative and
 * the role is `none` — which is three lines here and a package there. The
 * markup, the class list, the tokens and the API are shadcn's, unchanged.
 */
function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}) {
  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
