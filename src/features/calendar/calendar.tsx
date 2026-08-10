'use client'

import { CalendarBody } from '@/features/calendar/calendar-body'
import { CalendarProvider } from '@/features/calendar/contexts/calendar-context'
import { DndProvider } from '@/features/calendar/contexts/dnd-context'
import { CalendarHeader } from '@/features/calendar/header/calendar-header'
import { CALENDAR_ITEMS_MOCK, USERS_MOCK } from '@/features/calendar/mocks'

export function Calendar() {
  return (
    <CalendarProvider events={CALENDAR_ITEMS_MOCK} users={USERS_MOCK} view='month'>
      <DndProvider>
        <div className='w-full overflow-hidden rounded-xl border bg-background'>
          <CalendarHeader />
          <CalendarBody />
        </div>
      </DndProvider>
    </CalendarProvider>
  )
}
