import { createFileRoute } from '@tanstack/react-router'
import { Map } from 'lucide-react'
import { WorkspacePage } from '@/features/workspace-page'

export const Route = createFileRoute('/_authenticated/plans/')({
  component: () => (
    <WorkspacePage
      title='Plans'
      description='Organize goals, milestones, and the work needed to reach them.'
      icon={Map}
      summary={[
        { label: 'Active plans', value: '7' },
        { label: 'Milestones', value: '21' },
        { label: 'Completed', value: '64%' },
      ]}
    />
  ),
})
