import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

/**
 * shadcn's Collapsible, exactly as the CLI vendors it.
 *
 * Radix rather than a `useState` and a conditional render, and the difference is
 * not cosmetic: the trigger gets `aria-expanded` and `aria-controls`, the panel
 * gets an id and `hidden` when closed, and the two stay in step. Every project
 * on this page with more epics than fit is one of these, so a reader on a screen
 * reader is told that a section is collapsed and how to open it, rather than
 * finding that eleven epics are simply not in the document.
 */
function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return <CollapsiblePrimitive.CollapsibleTrigger data-slot="collapsible-trigger" {...props} />
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return <CollapsiblePrimitive.CollapsibleContent data-slot="collapsible-content" {...props} />
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
