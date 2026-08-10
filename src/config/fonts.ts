/**
 * Font choices exposed on `/settings/appearance`.
 *
 * To add another font:
 * 1. Add its name to this tuple.
 * 2. Install and import its self-hosted package in `src/app/layout.tsx`.
 * 3. Register its Tailwind variable and explicit HTML class in
 *    `src/styles/theme.css`.
 */
export const fonts = ['inter', 'manrope', 'system'] as const
