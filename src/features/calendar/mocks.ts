import type { IEvent, IUser } from '@/features/calendar/interfaces'

export const USERS_MOCK: IUser[] = [
  { id: 'creative', name: 'Creative Team', picturePath: null },
  { id: 'production', name: 'Production Team', picturePath: null },
  { id: 'client-success', name: 'Client Success', picturePath: null },
  { id: 'accounts', name: 'Accounts Team', picturePath: null },
]

const eventDate = (dayOffset: number, hour: number, minute = 0) => {
  const value = new Date()
  value.setDate(value.getDate() + dayOffset)
  value.setHours(hour, minute, 0, 0)
  return value.toISOString()
}

export const CALENDAR_ITEMS_MOCK: IEvent[] = [
  {
    id: 1,
    title: 'Weekly creative stand-up',
    description: 'Review active client work, priorities, and blockers.',
    startDate: eventDate(0, 10),
    endDate: eventDate(0, 10, 45),
    color: 'blue',
    user: USERS_MOCK[0],
  },
  {
    id: 2,
    title: 'Client discovery call',
    description: 'Discovery session for the new brand and website enquiry.',
    startDate: eventDate(0, 14),
    endDate: eventDate(0, 15),
    color: 'purple',
    user: USERS_MOCK[2],
  },
  {
    id: 3,
    title: 'Campaign concept review',
    description: 'Internal review of the first campaign concept direction.',
    startDate: eventDate(1, 11),
    endDate: eventDate(1, 12, 30),
    color: 'orange',
    user: USERS_MOCK[0],
  },
  {
    id: 4,
    title: 'Quotation follow-up',
    description: 'Follow up on outstanding website and social retainers.',
    startDate: eventDate(1, 16),
    endDate: eventDate(1, 16, 30),
    color: 'green',
    user: USERS_MOCK[3],
  },
  {
    id: 5,
    title: 'Production planning',
    description: 'Confirm resources and delivery dates for next week.',
    startDate: eventDate(2, 9, 30),
    endDate: eventDate(2, 10, 30),
    color: 'yellow',
    user: USERS_MOCK[1],
  },
  {
    id: 6,
    title: 'Website design presentation',
    description: 'Present approved page designs and collect client feedback.',
    startDate: eventDate(3, 13),
    endDate: eventDate(3, 14, 30),
    color: 'purple',
    user: USERS_MOCK[2],
  },
  {
    id: 7,
    title: 'Social content shoot',
    description: 'On-location content production for the monthly campaign.',
    startDate: eventDate(4, 9),
    endDate: eventDate(4, 17),
    color: 'red',
    user: USERS_MOCK[1],
  },
  {
    id: 8,
    title: 'Monthly reporting',
    description: 'Compile delivery, pipeline, and performance reporting.',
    startDate: eventDate(6, 11),
    endDate: eventDate(6, 12),
    color: 'blue',
    user: USERS_MOCK[3],
  },
  {
    id: 9,
    title: 'Brand launch window',
    description: 'Final checks and coordinated launch support.',
    startDate: eventDate(8, 9),
    endDate: eventDate(10, 18),
    color: 'green',
    user: USERS_MOCK[1],
  },
  {
    id: 10,
    title: 'Retrospective',
    description: 'Review delivery outcomes and capture improvements.',
    startDate: eventDate(-2, 15),
    endDate: eventDate(-2, 16),
    color: 'orange',
    user: USERS_MOCK[0],
  },
]
