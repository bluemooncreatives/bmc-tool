'use client'

import { useState } from 'react'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {
  createBrowserHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { handleServerError } from '@/lib/handle-server-error'
import { DirectionProvider } from '@/context/direction-provider'
import { ThemeProvider } from '@/context/theme-provider'

function createIsolatedBrowserHistory() {
  const browserHistory = window.history
  const nativePushState = History.prototype.pushState
  const nativeReplaceState = History.prototype.replaceState

  const historyBridge = {
    get length() {
      return browserHistory.length
    },
    get state() {
      return browserHistory.state
    },
    pushState(state: unknown, title: string, url?: string | URL | null) {
      nativePushState.call(
        browserHistory,
        { ...browserHistory.state, ...(state as object) },
        title,
        url
      )
    },
    replaceState(state: unknown, title: string, url?: string | URL | null) {
      const nextState = { ...browserHistory.state, ...(state as object) }
      nativeReplaceState.call(browserHistory, nextState, title, url)
    },
    go: browserHistory.go.bind(browserHistory),
    back: browserHistory.back.bind(browserHistory),
    forward: browserHistory.forward.bind(browserHistory),
  }

  return createBrowserHistory({
    window: {
      history: historyBridge,
      location: window.location,
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window),
    },
  })
}

function createAppRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.log({ failureCount, error })
            return false
          }

          if (failureCount > 3) return false

          return !(
            error instanceof AxiosError &&
            [401, 403].includes(error.response?.status ?? 0)
          )
        },
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
        staleTime: 10 * 1000,
      },
      mutations: {
        onError: (error) => {
          handleServerError(error)

          if (error instanceof AxiosError && error.response?.status === 304) {
            toast.error('Content not modified!')
          }
        },
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (!(error instanceof AxiosError)) return

        if (error.response?.status === 401) {
          toast.error('Session expired!')
          useAuthStore.getState().auth.reset()
          const redirect = router.history.location.href
          router.navigate({ to: '/sign-in', search: { redirect } })
        }

        if (error.response?.status === 500) {
          toast.error('Internal Server Error!')
          if (process.env.NODE_ENV === 'production') {
            router.navigate({ to: '/500' })
          }
        }
      },
    }),
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createIsolatedBrowserHistory(),
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return { queryClient, router }
}

export default function AdminApplication() {
  const [{ queryClient, router }] = useState(createAppRouter)

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DirectionProvider>
          <RouterProvider router={router} />
        </DirectionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
