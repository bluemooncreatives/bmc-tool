import { Outlet } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { hasModulePermission, type ModuleKey } from '@/lib/permissions'
import { Separator } from '@/components/ui/separator'
import { MODULE_ICONS } from '@/components/app-icons'
import { HeaderActions } from '@/components/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { SidebarNav } from './components/sidebar-nav'

const sidebarNavItems = [
  {
    title: 'Profile & Account',
    href: '/settings',
    icon: <MODULE_ICONS.settings_profile size={18} />,
    permissions: ['settings_profile', 'settings_account'],
  },
  {
    title: 'Appearance',
    href: '/settings/appearance',
    icon: <MODULE_ICONS.settings_appearance size={18} />,
    permission: 'settings_appearance',
  },
  {
    title: 'Notifications',
    href: '/settings/notifications',
    icon: <MODULE_ICONS.settings_notifications size={18} />,
    permission: 'settings_notifications',
  },
  {
    title: 'Display',
    href: '/settings/display',
    icon: <MODULE_ICONS.settings_display size={18} />,
    permission: 'settings_display',
  },
]

export function Settings() {
  const user = useAuthStore((state) => state.auth.user)
  const visibleItems = user
    ? sidebarNavItems.filter((item) =>
        (item.permissions ?? [item.permission]).some((permission) =>
          hasModulePermission(user, permission as ModuleKey)
        )
      )
    : []
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search />
        <HeaderActions />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <div className='flex-none space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            Settings
          </h1>
          <p className='text-muted-foreground'>
            Manage your account settings and set e-mail preferences.
          </p>
        </div>
        <Separator className='my-4 flex-none lg:my-6' />
        <div className='flex min-h-0 min-w-0 flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 flex-none lg:sticky lg:w-1/5'>
            <SidebarNav items={visibleItems} />
          </aside>
          <div className='flex min-h-0 min-w-0 flex-1 overflow-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
