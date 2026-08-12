import { create } from 'zustand'
import { apiFetch } from '@/lib/api-client'

export interface AuthUser {
  id: string
  accountNo: string
  email: string
  username: string
  displayEmail: string
  name?: string
  hiddenSidebarItems?: string[]
  role: string[]
  status?: 'active' | 'inactive' | 'invited' | 'pending' | 'suspended'
  firstName?: string
  lastName?: string
  mfaEnabled?: boolean
  modulePermissions?: string[]
  moduleActions?: Record<string, string[]>
  /** The tenant this account belongs to. Every screen is scoped by it. */
  organizationId?: string
  organizationCode?: string
  organizationName?: string
  scope?: 'platform' | 'organization'
  designationTitle?: string
  departmentName?: string
  jobTitle?: string
  isSystemOwner?: boolean
  /** True while the account is still on an administrator-issued password. */
  mustChangePassword?: boolean
}

/**
 * `pending` means the session has not been resolved against the server yet, so
 * guards must wait rather than treat the user as signed out.
 */
export type AuthStatus = 'pending' | 'authenticated' | 'unauthenticated'

type Credentials = { email: string; password: string }
type SignUpCredentials = Credentials & {
  username: string
  /** The tenant the new account is joining. */
  organizationCode: string
}
/** rememberMe=false keeps the session only until the browser closes. */
type SignInCredentials = Credentials & { rememberMe?: boolean }
type SessionResponse = { user: AuthUser }
export type OtpRequiredResponse = {
  requiresOtp: true
  challengeId: string
  email: string
  expiresIn: number
  resendAfter: number
}
export type SignInResult = AuthUser | OtpRequiredResponse
/** Returned when the organization vets new members before they can sign in. */
export type PendingApprovalResponse = {
  pendingApproval: true
  message: string
}
export type SignUpResult = AuthUser | PendingApprovalResponse

interface AuthState {
  auth: {
    user: AuthUser | null
    status: AuthStatus
    setUser: (user: AuthUser | null) => void
    /** Resolves the session from the httpOnly cookies. Safe to call repeatedly. */
    hydrate: () => Promise<AuthUser | null>
    signIn: (credentials: SignInCredentials) => Promise<SignInResult>
    signUp: (credentials: SignUpCredentials) => Promise<SignUpResult>
    signOut: () => Promise<void>
    /** Clears local state only — use signOut to also drop the server session. */
    reset: () => void
  }
}

/** Shared so concurrent route guards trigger a single /me request. */
let inFlightHydration: Promise<AuthUser | null> | null = null

export const useAuthStore = create<AuthState>()((set, get) => {
  function setAuth(patch: Partial<AuthState['auth']>) {
    set((state) => ({ ...state, auth: { ...state.auth, ...patch } }))
  }

  return {
    auth: {
      user: null,
      status: 'pending',

      setUser: (user) =>
        setAuth({
          user,
          status: user ? 'authenticated' : 'unauthenticated',
        }),

      hydrate: () => {
        if (!inFlightHydration) {
          inFlightHydration = apiFetch<SessionResponse>('/api/auth/me')
            .then(({ user }) => {
              get().auth.setUser(user)
              return user
            })
            .catch(() => {
              // Any failure here — 401, offline, server error — leaves the app
              // signed out rather than stuck on `pending`.
              get().auth.setUser(null)
              return null
            })
            .finally(() => {
              inFlightHydration = null
            })
        }
        return inFlightHydration
      },

      signIn: async (credentials) => {
        const response = await apiFetch<SessionResponse | OtpRequiredResponse>(
          '/api/auth/sign-in',
          {
            method: 'POST',
            body: credentials,
          }
        )
        if ('requiresOtp' in response) return response

        get().auth.setUser(response.user)
        return response.user
      },

      signUp: async (credentials) => {
        const response = await apiFetch<
          SessionResponse | PendingApprovalResponse
        >('/api/auth/sign-up', {
          method: 'POST',
          body: credentials,
        })
        // An organization that vets its members answers without a session, so
        // there is nothing to hydrate — the caller shows the pending message.
        if ('pendingApproval' in response) return response

        get().auth.setUser(response.user)
        return response.user
      },

      signOut: async () => {
        try {
          await apiFetch('/api/auth/sign-out', { method: 'POST' })
        } finally {
          // Clear locally even if the request failed, so the UI never shows a
          // signed-in state the user asked to leave.
          get().auth.reset()
        }
      },

      reset: () => setAuth({ user: null, status: 'unauthenticated' }),
    },
  }
})
