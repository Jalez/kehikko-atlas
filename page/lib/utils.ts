import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * shadcn's class helper, unchanged from what the CLI vendors.
 *
 * `clsx` flattens conditionals; `twMerge` makes the LAST conflicting Tailwind
 * class win, which is the whole reason this exists — without it, a component
 * that hardcodes `p-4` and a caller that passes `p-6` produce an element with
 * both, and which one applies is decided by the order Tailwind happened to emit
 * them in rather than by the caller.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
