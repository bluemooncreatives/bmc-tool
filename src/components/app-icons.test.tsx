import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { NOTIFICATION_CATEGORY_ICONS } from './app-icons'

describe('application icon mapping', () => {
  it('maps category names to semantic icons', async () => {
    const expectedIcons = {
      system: 'lucide-server-cog',
      security: 'lucide-shield-check',
      permissions: 'lucide-key-round',
      home: 'lucide-house',
      tasks: 'lucide-list-todo',
      tasks_active: 'lucide-circle-dot-dashed',
      leads: 'lucide-contact-round',
      quotations: 'lucide-file-text',
      calendars: 'lucide-calendar-days',
      plans: 'lucide-map',
      schedule: 'lucide-clock-3',
      reports_analytics: 'lucide-chart-no-axes-combined',
      settings_profile: 'lucide-user-cog',
      settings_account: 'lucide-wrench',
      settings_appearance: 'lucide-palette',
      settings_notifications: 'lucide-bell-ring',
      settings_display: 'lucide-monitor',
      help_center: 'lucide-circle-question-mark',
    } as const

    const screen = await render(
      <div>
        {Object.entries(NOTIFICATION_CATEGORY_ICONS).map(([category, Icon]) => (
          <Icon key={category} data-testid={category} />
        ))}
      </div>
    )

    for (const [category, iconClass] of Object.entries(expectedIcons)) {
      await expect.element(screen.getByTestId(category)).toHaveClass(iconClass)
    }
  })
})
