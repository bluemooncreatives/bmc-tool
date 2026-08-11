import { NotificationCenter } from '@/components/notification-center'
import { ThemeSwitch } from '@/components/theme-switch'

export function HeaderActions() {
  return (
    <>
      <ThemeSwitch />
      <NotificationCenter />
    </>
  )
}
