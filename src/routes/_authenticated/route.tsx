import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { canAccessPath } from '@/lib/permissions'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

const SET_PASSWORD_PATH = '/set-password'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()

    // Resolve against MongoDB on every authenticated navigation. Permission
    // updates bump tokenVersion, so revoked access cannot survive in stale
    // client state until the next full page reload.
    const user = await auth.hydrate()

    if (!user) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }

    // An account still holding an administrator-issued password gets exactly
    // one destination until it chooses its own. The path itself is excluded so
    // the redirect cannot loop.
    if (user.mustChangePassword && location.pathname !== SET_PASSWORD_PATH) {
      throw redirect({ to: SET_PASSWORD_PATH })
    }

    if (
      location.pathname !== SET_PASSWORD_PATH &&
      !canAccessPath(user, location.pathname)
    ) {
      throw redirect({ to: '/403' })
    }
  },
  component: AuthenticatedLayout,
})
