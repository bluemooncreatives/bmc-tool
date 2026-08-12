import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bookmark,
  Bug,
  CheckCircle,
  Circle,
  CircleOff,
  Flag,
  HelpCircle,
  Lightbulb,
  Sparkles,
  Star,
  Tag,
  Timer,
  Wrench,
} from 'lucide-react'

export const ICONS = {
  circle: Circle,
  'help-circle': HelpCircle,
  timer: Timer,
  'check-circle': CheckCircle,
  'circle-off': CircleOff,
  'arrow-down': ArrowDown,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'alert-circle': AlertCircle,
  tag: Tag,
  flag: Flag,
  bug: Bug,
  star: Star,
  bookmark: Bookmark,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  wrench: Wrench,
} as const

export type IconKey = keyof typeof ICONS
export const ICON_KEYS = Object.keys(ICONS) as IconKey[]
