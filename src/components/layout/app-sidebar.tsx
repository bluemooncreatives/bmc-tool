import { useLayout } from '@/context/layout-provider'
import { useAuthStore } from '@/stores/auth-store'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { filterNavGroups } from './data/filter-sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const user = useAuthStore((state) => state.auth.user)
  const navGroups = user
    ? filterNavGroups(sidebarData.navGroups, user)
    : []
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'BMC Team'
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name,
            email: user?.email ?? sidebarData.user.email,
            avatar: sidebarData.user.avatar,
          }}
          permissions={user}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
