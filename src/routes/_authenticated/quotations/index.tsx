import { createFileRoute } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import { WorkspacePage } from '@/features/workspace-page'

export const Route = createFileRoute('/_authenticated/quotations/')({
  component: () => (
    <WorkspacePage
      title='Quotations'
      description='Create, review, and follow up on customer quotations.'
      icon={FileText}
      summary={[
        { label: 'Draft', value: '8' },
        { label: 'Sent', value: '16' },
        { label: 'Accepted', value: '11' },
      ]}
    />
  ),
})
