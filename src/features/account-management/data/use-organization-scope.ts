import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError } from '@/lib/api-client'
import { isSuperadmin } from '@/lib/permissions'
import { listOrganizations } from './api'
import { type Organization } from './types'

export type OrganizationScope = {
  organizations: Organization[]
  /** The organization the screen is currently acting on. */
  selected: Organization | null
  selectedId: string
  setSelectedId: (id: string) => void
  /** True when the viewer may switch between tenants. */
  canSwitchOrganization: boolean
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Resolves which organizations the signed-in administrator may act on.
 *
 * The Super Admin gets a switcher across every tenant; an organization
 * administrator gets exactly one, and the API refuses any other id anyway —
 * this only decides what the UI offers.
 */
export function useOrganizationScope(
  options: { includeArchived?: boolean } = {}
): OrganizationScope {
  const user = useAuthStore((state) => state.auth.user)
  const canSwitchOrganization = user ? isSuperadmin(user) : false

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const includeArchived = options.includeArchived ?? false

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listOrganizations({ includeArchived })
      setOrganizations(response.organizations)
      setSelectedId((current) => {
        if (current && response.organizations.some((org) => org.id === current)) {
          return current
        }
        // Default to the viewer's own organization when it is in the list, so
        // an organization admin never sees an empty selector.
        return (
          response.organizations.find((org) => org.id === user?.organizationId)
            ?.id ??
          response.organizations[0]?.id ??
          ''
        )
      })
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load organizations.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [includeArchived, user?.organizationId])

  useEffect(() => {
    // Initial server synchronization; reload owns every state update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  return {
    organizations,
    selected: organizations.find((org) => org.id === selectedId) ?? null,
    selectedId,
    setSelectedId,
    canSwitchOrganization,
    isLoading,
    error,
    reload,
  }
}
