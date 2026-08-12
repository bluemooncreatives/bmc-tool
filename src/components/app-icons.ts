import {
  BellRing,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleHelp,
  CircleDotDashed,
  Clock3,
  ContactRound,
  FileText,
  Home,
  KeyRound,
  ListTodo,
  Map,
  Monitor,
  Network,
  Palette,
  ServerCog,
  ShieldCheck,
  UserCog,
  UserPlus,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { type NotificationCategory } from '@/lib/notifications'
import { type ModuleKey } from '@/lib/permissions'

export const MODULE_ICONS = {
  home: Home,
  tasks: ListTodo,
  tasks_active: CircleDotDashed,
  leads: ContactRound,
  quotations: FileText,
  calendars: CalendarDays,
  plans: Map,
  schedule: Clock3,
  reports_analytics: ChartNoAxesCombined,
  settings_profile: UserCog,
  settings_account: Wrench,
  settings_appearance: Palette,
  settings_notifications: BellRing,
  settings_display: Monitor,
  help_center: CircleHelp,
  account_organizations: Building2,
  account_users: UserPlus,
  account_control: Network,
} satisfies Record<ModuleKey, LucideIcon>

export const NOTIFICATION_CATEGORY_ICONS = {
  system: ServerCog,
  security: ShieldCheck,
  permissions: KeyRound,
  ...MODULE_ICONS,
} satisfies Record<NotificationCategory, LucideIcon>
