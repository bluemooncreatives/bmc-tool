import { createFileRoute, redirect } from '@tanstack/react-router'

/** Legacy alias retained for old bookmarks; management now lives in one place. */
export const Route = createFileRoute('/_authenticated/users/')({
  beforeLoad: () => {
    throw redirect({ to: '/permission-manager' })
  },
})
