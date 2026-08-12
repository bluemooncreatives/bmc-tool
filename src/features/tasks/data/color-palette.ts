// Fixed palette of complete Tailwind class strings. Classes must appear
// literally in source (not be built from interpolated strings) so the
// Tailwind JIT scanner picks them up — this lets users pick a color for a
// custom label/status/priority without breaking the build.
export const COLOR_PALETTE = {
  slate: {
    name: 'Slate',
    text: 'text-slate-600 dark:text-slate-400',
    badge:
      'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
    swatch: 'bg-slate-500',
  },
  sky: {
    name: 'Sky',
    text: 'text-sky-600 dark:text-sky-400',
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
    swatch: 'bg-sky-500',
  },
  amber: {
    name: 'Amber',
    text: 'text-amber-600 dark:text-amber-400',
    badge:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    swatch: 'bg-amber-500',
  },
  emerald: {
    name: 'Emerald',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    swatch: 'bg-emerald-500',
  },
  rose: {
    name: 'Rose',
    text: 'text-rose-600 dark:text-rose-400',
    badge:
      'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    swatch: 'bg-rose-500',
  },
  orange: {
    name: 'Orange',
    text: 'text-orange-600 dark:text-orange-400',
    badge:
      'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
    swatch: 'bg-orange-500',
  },
  red: {
    name: 'Red',
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
    swatch: 'bg-red-500',
  },
  violet: {
    name: 'Violet',
    text: 'text-violet-600 dark:text-violet-400',
    badge:
      'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
    swatch: 'bg-violet-500',
  },
  blue: {
    name: 'Blue',
    text: 'text-blue-600 dark:text-blue-400',
    badge:
      'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    swatch: 'bg-blue-500',
  },
  teal: {
    name: 'Teal',
    text: 'text-teal-600 dark:text-teal-400',
    badge:
      'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
    swatch: 'bg-teal-500',
  },
  pink: {
    name: 'Pink',
    text: 'text-pink-600 dark:text-pink-400',
    badge:
      'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
    swatch: 'bg-pink-500',
  },
  indigo: {
    name: 'Indigo',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge:
      'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
    swatch: 'bg-indigo-500',
  },
} as const

export type ColorKey = keyof typeof COLOR_PALETTE
export const COLOR_KEYS = Object.keys(COLOR_PALETTE) as ColorKey[]
