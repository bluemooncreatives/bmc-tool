import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import {
  hasAccountSettingsAccess,
  hasModulePermission,
} from '@/lib/permissions'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const user = useAuthStore((state) => state.auth.user)
  const displayName =
    user?.name ||
    user?.username ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    'BMC Team'
  const displayEmail =
    user?.displayEmail ?? user?.email ?? 'Blue Moon Creatives'
  const settingsLinks = user
    ? [
        ...(hasAccountSettingsAccess(user)
          ? [
              {
                to: '/settings' as const,
                label: 'Profile & Account',
                permission: null,
              },
            ]
          : []),
        {
          to: '/settings/notifications' as const,
          label: 'Notifications',
          permission: 'settings_notifications' as const,
        },
      ].filter(
        (item) =>
          item.permission === null || hasModulePermission(user, item.permission)
      )
    : []

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage
                src='/images/favicon.png'
                alt='Blue Moon Creatives'
              />
              <AvatarFallback>BMC</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='truncate text-sm leading-none font-medium'>
                {displayName}
              </p>
              <p className='text-xs leading-none text-muted-foreground'>
                {displayEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          {settingsLinks.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {settingsLinks.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
