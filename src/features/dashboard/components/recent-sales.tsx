import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const activity = [
  {
    initials: 'QA',
    title: 'Quotation approved',
    detail: 'Brand campaign proposal',
    meta: 'Today',
  },
  {
    initials: 'NL',
    title: 'New lead qualified',
    detail: 'Website redesign enquiry',
    meta: '1h ago',
  },
  {
    initials: 'TC',
    title: 'Task completed',
    detail: 'Homepage creative review',
    meta: '2h ago',
  },
  {
    initials: 'MS',
    title: 'Meeting scheduled',
    detail: 'Client discovery call',
    meta: 'Tomorrow',
  },
  {
    initials: 'PU',
    title: 'Plan updated',
    detail: 'Monthly content calendar',
    meta: 'Yesterday',
  },
]

export function RecentSales() {
  return (
    <div className='space-y-8'>
      {activity.map((item) => (
        <div key={`${item.title}-${item.detail}`} className='flex items-center gap-4'>
          <Avatar className='h-9 w-9 border'>
            <AvatarFallback>{item.initials}</AvatarFallback>
          </Avatar>
          <div className='flex min-w-0 flex-1 items-center justify-between gap-4'>
            <div className='min-w-0 space-y-1'>
              <p className='truncate text-sm leading-none font-medium'>
                {item.title}
              </p>
              <p className='truncate text-sm text-muted-foreground'>
                {item.detail}
              </p>
            </div>
            <div className='shrink-0 text-xs text-muted-foreground'>
              {item.meta}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
