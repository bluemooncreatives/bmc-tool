import { CalendarDays } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Calendar } from '@/features/calendar/calendar'

export function CalendarPage() {
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fluid className='min-w-0'>
        <div className='mb-6 flex items-start gap-4'>
          <div className='rounded-lg bg-primary/10 p-3 text-primary'>
            <CalendarDays className='size-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Event Calendar</h1>
            <p className='text-muted-foreground'>
              Plan client meetings, production, reviews, and team deadlines.
            </p>
          </div>
        </div>

        <Calendar />
      </Main>
    </>
  )
}
