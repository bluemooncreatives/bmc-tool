import { createFileRoute } from '@tanstack/react-router'
import { ContactRound } from 'lucide-react'
import { WorkspacePage } from '@/features/workspace-page'

export const Route = createFileRoute('/_authenticated/leads/')({
  component: () => (
    <WorkspacePage
      title='Leads'
      description='Track prospects and move opportunities through your pipeline.'
      icon={ContactRound}
      summary={[
        { label: 'New leads', value: '24' },
        { label: 'Qualified', value: '12' },
        { label: 'Conversion rate', value: '18%' },
      ]}
    />
  ),
})
