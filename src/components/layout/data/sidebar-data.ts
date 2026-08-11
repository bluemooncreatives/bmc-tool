import {
  Monitor,
  ListTodo,
  HelpCircle,
  Bell,
  Palette,
  Settings,
  Wrench,
  UserCog,
  Home,
  ContactRound,
  FileText,
  CalendarDays,
  Map,
  Clock3,
  ChartNoAxesCombined,
  MoonStar,
  ShieldCheck,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'BMC Team',
    email: 'Blue Moon Creatives',
    avatar: '/images/favicon.png',
  },
  teams: [
    {
      name: 'Blue Moon Creatives',
      logo: MoonStar,
      plan: 'Internal Workspace',
    },
  ],
  navGroups: [
    {
      title: 'Operations',
      items: [
        {
          title: 'Home',
          url: '/',
          icon: Home,
          permission: 'home',
        },
        {
          title: 'Tasks',
          url: '/tasks',
          icon: ListTodo,
          permission: 'tasks',
        },
        {
          title: 'Leads',
          url: '/leads',
          icon: ContactRound,
          permission: 'leads',
        },
        {
          title: 'Quotations',
          url: '/quotations',
          icon: FileText,
          permission: 'quotations',
        },
        {
          title: 'Calendars',
          url: '/calenders',
          icon: CalendarDays,
          permission: 'calendars',
        },
        {
          title: 'Plans',
          url: '/plans',
          icon: Map,
          permission: 'plans',
        },
        {
          title: 'Schedule',
          url: '/schedule',
          icon: Clock3,
          permission: 'schedule',
        },
        {
          title: 'Reports & Analytics',
          url: '/reports-analytics',
          icon: ChartNoAxesCombined,
          permission: 'reports_analytics',
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'Profile',
              url: '/settings',
              icon: UserCog,
              permission: 'settings_profile',
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
              permission: 'settings_account',
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
              permission: 'settings_appearance',
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
              permission: 'settings_notifications',
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
              permission: 'settings_display',
            },
          ],
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
          permission: 'help_center',
        },
      ],
    },
    {
      title: 'Administration',
      items: [
        {
          title: 'Permission Manager',
          url: '/permission-manager',
          icon: ShieldCheck,
          superadminOnly: true,
        },
      ],
    },
  ],
}
