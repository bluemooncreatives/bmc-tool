import { create } from 'zustand'
import { apiFetch, ApiError } from '@/lib/api-client'
import {
  type AppNotification,
  type NotificationListResponse,
} from '@/lib/notifications'

type NotificationState = {
  userId: string | null
  notifications: AppNotification[]
  unreadCount: number
  nextCursor: string | null
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  initialize: (userId: string | null) => void
  load: (userId: string, append?: boolean) => Promise<void>
  markRead: (ids: string[], read?: boolean) => Promise<void>
  markAllRead: () => Promise<void>
  archive: (ids: string[]) => Promise<void>
  archiveRead: () => Promise<void>
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Could not load notifications. Please try again.'
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  userId: null,
  notifications: [],
  unreadCount: 0,
  nextCursor: null,
  isLoading: false,
  isLoadingMore: false,
  error: null,

  initialize: (userId) => {
    if (get().userId === userId) return
    set({
      userId,
      notifications: [],
      unreadCount: 0,
      nextCursor: null,
      isLoading: false,
      isLoadingMore: false,
      error: null,
    })
  },

  load: async (userId, append = false) => {
    const state = get()
    if (state.userId !== userId) state.initialize(userId)
    if (append ? get().isLoadingMore : get().isLoading) return

    const cursor = append ? get().nextCursor : null
    if (append && !cursor) return
    set(
      append
        ? { isLoadingMore: true, error: null }
        : { isLoading: true, error: null }
    )
    try {
      const search = new URLSearchParams({ limit: '20' })
      if (cursor) search.set('cursor', cursor)
      const response = await apiFetch<NotificationListResponse>(
        `/api/notifications?${search}`
      )
      if (get().userId !== userId) return
      set((current) => ({
        notifications: append
          ? [
              ...current.notifications,
              ...response.notifications.filter(
                (item) =>
                  !current.notifications.some(
                    (existing) => existing.id === item.id
                  )
              ),
            ]
          : response.notifications,
        unreadCount: response.unreadCount,
        nextCursor: response.nextCursor,
      }))
    } catch (error) {
      if (get().userId === userId) set({ error: errorMessage(error) })
    } finally {
      if (get().userId === userId) {
        set(append ? { isLoadingMore: false } : { isLoading: false })
      }
    }
  },

  markRead: async (ids, read = true) => {
    if (ids.length === 0) return
    const previous = get()
    const idSet = new Set(ids)
    const changedUnread = previous.notifications.filter(
      (item) => idSet.has(item.id) && !item.readAt
    ).length
    const changedRead = previous.notifications.filter(
      (item) => idSet.has(item.id) && item.readAt
    ).length
    const now = new Date().toISOString()
    set({
      notifications: previous.notifications.map((item) =>
        idSet.has(item.id) ? { ...item, readAt: read ? now : undefined } : item
      ),
      unreadCount: Math.max(
        0,
        previous.unreadCount + (read ? -changedUnread : changedRead)
      ),
    })
    try {
      const response = await apiFetch<{ unreadCount: number }>(
        '/api/notifications',
        { method: 'PATCH', body: { action: 'mark', ids, read } }
      )
      set({ unreadCount: response.unreadCount })
    } catch (error) {
      set({
        notifications: previous.notifications,
        unreadCount: previous.unreadCount,
        error: errorMessage(error),
      })
    }
  },

  markAllRead: async () => {
    const previous = get()
    const now = new Date().toISOString()
    set({
      notifications: previous.notifications.map((item) => ({
        ...item,
        readAt: item.readAt ?? now,
      })),
      unreadCount: 0,
    })
    try {
      await apiFetch('/api/notifications', {
        method: 'PATCH',
        body: { action: 'mark-all' },
      })
    } catch (error) {
      set({
        notifications: previous.notifications,
        unreadCount: previous.unreadCount,
        error: errorMessage(error),
      })
    }
  },

  archive: async (ids) => {
    if (ids.length === 0) return
    const previous = get()
    const idSet = new Set(ids)
    const removedUnread = previous.notifications.filter(
      (item) => idSet.has(item.id) && !item.readAt
    ).length
    set({
      notifications: previous.notifications.filter(
        (item) => !idSet.has(item.id)
      ),
      unreadCount: Math.max(0, previous.unreadCount - removedUnread),
    })
    try {
      const response = await apiFetch<{ unreadCount: number }>(
        '/api/notifications',
        { method: 'PATCH', body: { action: 'archive', ids } }
      )
      set({ unreadCount: response.unreadCount })
    } catch (error) {
      set({
        notifications: previous.notifications,
        unreadCount: previous.unreadCount,
        error: errorMessage(error),
      })
    }
  },

  archiveRead: async () => {
    const previous = get()
    set({
      notifications: previous.notifications.filter((item) => !item.readAt),
    })
    try {
      const response = await apiFetch<{ unreadCount: number }>(
        '/api/notifications',
        { method: 'PATCH', body: { action: 'archive-read' } }
      )
      set({ unreadCount: response.unreadCount })
    } catch (error) {
      set({ notifications: previous.notifications, error: errorMessage(error) })
    }
  },
}))
