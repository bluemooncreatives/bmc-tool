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
        },
        {
          title: 'Tasks',
          url: '/tasks',
          icon: ListTodo,
        },
        {
          title: 'Leads',
          url: '/leads',
          icon: ContactRound,
        },
        {
          title: 'Quotations',
          url: '/quotations',
          icon: FileText,
        },
        {
          title: 'Calenders',
          url: '/calenders',
          icon: CalendarDays,
        },
        {
          title: 'Plans',
          url: '/plans',
          icon: Map,
        },
        {
          title: 'Schedule',
          url: '/schedule',
          icon: Clock3,
        },
        {
          title: 'Reports & Analytics',
          url: '/reports-analytics',
          icon: ChartNoAxesCombined,
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
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
