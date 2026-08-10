import { createFileRoute } from '@tanstack/react-router'
import { ChartNoAxesCombined } from 'lucide-react'
import { WorkspacePage } from '@/features/workspace-page'

export const Route = createFileRoute('/_authenticated/reports-analytics/')({
  component: () => (
    <WorkspacePage
      title='Reports & Analytics'
      description='Monitor performance and turn workspace activity into insights.'
      icon={ChartNoAxesCombined}
      summary={[
        { label: 'Tasks completed', value: '148' },
        { label: 'Lead growth', value: '+12%' },
        { label: 'Revenue forecast', value: '$84K' },
      ]}
    />
  ),
})
