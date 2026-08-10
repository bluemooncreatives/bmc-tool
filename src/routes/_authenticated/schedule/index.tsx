import { createFileRoute } from '@tanstack/react-router'
import { Clock3 } from 'lucide-react'
import { WorkspacePage } from '@/features/workspace-page'

export const Route = createFileRoute('/_authenticated/schedule/')({
  component: () => (
    <WorkspacePage
      title='Schedule'
      description='Coordinate assignments and upcoming work across the team.'
      icon={Clock3}
      summary={[
        { label: 'Scheduled today', value: '9' },
        { label: 'In progress', value: '6' },
        { label: 'Unassigned', value: '3' },
      ]}
    />
  ),
})
