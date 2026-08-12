import { type NavigateFn } from '@/hooks/use-table-url-state'
import { HeaderActions } from '@/components/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { TasksDialogs } from './components/tasks-dialogs'
import { TasksPrimaryButtons } from './components/tasks-primary-buttons'
import { TasksProvider, type TaskScope } from './components/tasks-provider'
import { TasksTable } from './components/tasks-table'

type TasksProps = {
  scope?: TaskScope
  search: Record<string, unknown>
  navigate: NavigateFn
}

export function Tasks({ scope = 'all', search, navigate }: TasksProps) {
  const activeOnly = scope === 'active'
  return (
    <TasksProvider scope={scope}>
      <Header fixed>
        <Search />
        <HeaderActions />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {activeOnly ? 'Active Tasks' : 'All Tasks'}
            </h2>
            <p className='text-muted-foreground'>
              {activeOnly
                ? 'Work that is still open, in progress, or awaiting action.'
                : 'Review active, completed, and canceled work in one place.'}
            </p>
          </div>
          <TasksPrimaryButtons />
        </div>
        <TasksTable
          search={search}
          navigate={navigate}
          emptyMessage={
            activeOnly
              ? 'No active tasks. Completed and canceled work is excluded.'
              : 'No tasks found.'
          }
        />
      </Main>

      <TasksDialogs />
    </TasksProvider>
  )
}
