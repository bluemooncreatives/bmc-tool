import { Settings, MoonStar } from 'lucide-react'
import {
  MODULE_ICONS,
  NOTIFICATION_CATEGORY_ICONS,
} from '@/components/app-icons'
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
          icon: MODULE_ICONS.home,
          permission: 'home',
        },
        {
          title: 'Tasks',
          icon: MODULE_ICONS.tasks,
          items: [
            {
              title: 'All Tasks',
              url: '/tasks',
              icon: MODULE_ICONS.tasks,
              permission: 'tasks',
            },
            {
              title: 'Active Tasks',
              url: '/tasks/active',
              icon: MODULE_ICONS.tasks_active,
              permission: 'tasks_active',
              permissionAnyOf: ['tasks', 'tasks_active'],
            },
          ],
        },
        {
          title: 'Leads',
          url: '/leads',
          icon: MODULE_ICONS.leads,
          permission: 'leads',
        },
        {
          title: 'Quotations',
          url: '/quotations',
          icon: MODULE_ICONS.quotations,
          permission: 'quotations',
        },
        {
          title: 'Calendars',
          url: '/calenders',
          icon: MODULE_ICONS.calendars,
          permission: 'calendars',
        },
        {
          title: 'Plans',
          url: '/plans',
          icon: MODULE_ICONS.plans,
          permission: 'plans',
        },
        {
          title: 'Schedule',
          url: '/schedule',
          icon: MODULE_ICONS.schedule,
          permission: 'schedule',
        },
        {
          title: 'Reports & Analytics',
          url: '/reports-analytics',
          icon: MODULE_ICONS.reports_analytics,
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
              title: 'Profile & Account',
              url: '/settings',
              icon: MODULE_ICONS.settings_profile,
              permission: 'settings_profile',
              permissionAnyOf: ['settings_profile', 'settings_account'],
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: MODULE_ICONS.settings_appearance,
              permission: 'settings_appearance',
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: MODULE_ICONS.settings_notifications,
              permission: 'settings_notifications',
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: MODULE_ICONS.settings_display,
              permission: 'settings_display',
            },
          ],
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: MODULE_ICONS.help_center,
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
          icon: NOTIFICATION_CATEGORY_ICONS.permissions,
          superadminOnly: true,
        },
      ],
    },
  ],
}
