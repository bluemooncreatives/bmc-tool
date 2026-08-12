import { getRouteApi } from '@tanstack/react-router'
import { Tasks } from '.'

const route = getRouteApi('/_authenticated/tasks/')

export function TasksRoute() {
  const search = route.useSearch()
  return (
    <Tasks
      search={search}
      navigate={route.useNavigate()}
      scope={search.view === 'active' ? 'active' : 'all'}
    />
  )
}
