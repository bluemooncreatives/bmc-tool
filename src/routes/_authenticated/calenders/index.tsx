import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays } from 'lucide-react'
import { WorkspacePage } from '@/features/workspace-page'

export const Route = createFileRoute('/_authenticated/calenders/')({
  component: () => (
    <WorkspacePage
      title='Calendars'
      description='Keep meetings, deadlines, and team events in one place.'
      icon={CalendarDays}
      summary={[
        { label: 'Today', value: '5' },
        { label: 'This week', value: '18' },
        { label: 'Upcoming', value: '32' },
      ]}
    />
  ),
})
