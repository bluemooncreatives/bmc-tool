import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { Link } from '@tanstack/react-router'
import {
  Archive,
  Bell,
  CalendarDays,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Info,
  ListTodo,
  Loader2,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useNotificationStore } from '@/stores/notification-store'
import {
  type AppNotification,
  type NotificationCategory,
} from '@/lib/notifications'
import { hasModulePermission } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'

const POLL_INTERVAL_MS = 30_000

function CategoryIcon({ category }: { category: NotificationCategory }) {
  if (category === 'security' || category === 'permissions') {
    return <ShieldCheck className='size-4' />
  }
  if (category === 'tasks' || category === 'schedule') {
    return <ListTodo className='size-4' />
  }
  if (category === 'calendars') return <CalendarDays className='size-4' />
  return <Info className='size-4' />
}

function LevelIcon({ notification }: { notification: AppNotification }) {
  const className = cn(
    'flex size-9 shrink-0 items-center justify-center rounded-full',
    notification.level === 'success' && 'bg-emerald-500/10 text-emerald-600',
    notification.level === 'warning' && 'bg-amber-500/10 text-amber-600',
    notification.level === 'error' && 'bg-destructive/10 text-destructive',
    notification.level === 'info' && 'bg-primary/10 text-primary'
  )
  return (
    <span className={className}>
      {notification.level === 'success' ? (
        <CircleCheck className='size-4' />
      ) : notification.level === 'warning' ? (
        <TriangleAlert className='size-4' />
      ) : notification.level === 'error' ? (
        <CircleAlert className='size-4' />
      ) : (
        <CategoryIcon category={notification.category} />
      )}
    </span>
  )
}

export function NotificationCenter() {
  const user = useAuthStore((state) => state.auth.user)
  const {
    notifications,
    unreadCount,
    nextCursor,
    isLoading,
    isLoadingMore,
    error,
    initialize,
    load,
    markRead,
    markAllRead,
    archive,
    archiveRead,
  } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    initialize(user?.id ?? null)
    if (!user) return

    void load(user.id)
    const refresh = () => {
      if (document.visibilityState === 'visible') void load(user.id)
    }
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [initialize, load, user])

  const visible = useMemo(
    () =>
      filter === 'unread'
        ? notifications.filter((notification) => !notification.readAt)
        : notifications,
    [filter, notifications]
  )

  if (!user) return null

  async function openNotification(notification: AppNotification) {
    if (!notification.readAt) await markRead([notification.id])
    if (notification.actionUrl) window.location.assign(notification.actionUrl)
  }

  const canManagePreferences = hasModulePermission(
    user,
    'settings_notifications'
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) void load(user.id)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative scale-95 rounded-full'
          aria-label={
            unreadCount
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell className='size-[1.2rem]' />
          {unreadCount > 0 && (
            <span className='absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold tracking-normal text-white ring-2 ring-background'>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        sideOffset={8}
        className='w-[min(24rem,calc(100vw-1rem))] overflow-hidden p-0'
      >
        <div className='flex items-start justify-between gap-3 border-b px-4 py-3'>
          <div>
            <h2 className='font-semibold'>Notifications</h2>
            <p className='text-xs text-muted-foreground'>
              {unreadCount
                ? `${unreadCount} unread updates`
                : 'You are all caught up'}
            </p>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='size-8'
              onClick={() => void load(user.id)}
              disabled={isLoading}
              aria-label='Refresh notifications'
            >
              <RefreshCw
                className={cn('size-4', isLoading && 'animate-spin')}
              />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='size-8'
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              aria-label='Mark all notifications as read'
            >
              <CheckCheck className='size-4' />
            </Button>
          </div>
        </div>

        <div className='flex items-center gap-1 border-b px-3 py-2'>
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size='sm'
            className='h-7'
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'unread' ? 'secondary' : 'ghost'}
            size='sm'
            className='h-7'
            onClick={() => setFilter('unread')}
          >
            Unread
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='ms-auto h-7 text-xs text-muted-foreground'
            onClick={() => void archiveRead()}
            disabled={
              !notifications.some((notification) => notification.readAt)
            }
          >
            Clear read
          </Button>
        </div>

        <ScrollArea className='h-[min(28rem,65vh)]'>
          {isLoading && notifications.length === 0 ? (
            <div className='flex h-40 items-center justify-center text-muted-foreground'>
              <Loader2 className='size-5 animate-spin' />
              <span className='sr-only'>Loading notifications</span>
            </div>
          ) : error && notifications.length === 0 ? (
            <div className='flex h-40 flex-col items-center justify-center gap-3 px-6 text-center'>
              <CircleAlert className='size-6 text-destructive' />
              <p className='text-sm text-muted-foreground'>{error}</p>
              <Button
                size='sm'
                variant='outline'
                onClick={() => void load(user.id)}
              >
                Try again
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className='flex h-40 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground'>
              <Bell className='size-7' />
              <p className='text-sm'>
                {filter === 'unread'
                  ? 'No unread notifications.'
                  : 'No notifications yet.'}
              </p>
            </div>
          ) : (
            <div className='divide-y'>
              {visible.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'group flex min-w-0 items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60',
                    !notification.readAt && 'bg-primary/[0.04]'
                  )}
                >
                  <LevelIcon notification={notification} />
                  <button
                    type='button'
                    className='min-w-0 flex-1 text-left'
                    onClick={() => void openNotification(notification)}
                  >
                    <span className='flex items-start gap-2'>
                      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
                        {notification.title}
                      </span>
                      {!notification.readAt && (
                        <span className='mt-1.5 size-2 shrink-0 rounded-full bg-primary' />
                      )}
                    </span>
                    <span className='mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground'>
                      {notification.message}
                    </span>
                    <span className='mt-1 block text-[11px] text-muted-foreground/80'>
                      {formatDistanceToNowStrict(
                        new Date(notification.createdAt),
                        { addSuffix: true }
                      )}
                    </span>
                  </button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-7 shrink-0 opacity-60 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100'
                    onClick={() => void archive([notification.id])}
                    aria-label={`Archive ${notification.title}`}
                  >
                    <Archive className='size-3.5' />
                  </Button>
                </div>
              ))}
              {nextCursor && filter === 'all' && (
                <div className='p-3 text-center'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => void load(user.id, true)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore && <Loader2 className='animate-spin' />}
                    Load earlier
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {canManagePreferences && (
          <div className='border-t p-2'>
            <Button
              variant='ghost'
              size='sm'
              className='w-full justify-center'
              asChild
            >
              <Link to='/settings/notifications' onClick={() => setOpen(false)}>
                <SlidersHorizontal className='size-4' />
                Notification preferences
              </Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
