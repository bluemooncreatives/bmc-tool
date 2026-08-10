import { type LucideIcon } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type WorkspacePageProps = {
  title: string
  description: string
  icon: LucideIcon
  summary: Array<{ label: string; value: string }>
}

export function WorkspacePage({
  title,
  description,
  icon: Icon,
  summary,
}: WorkspacePageProps) {
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-8 flex items-start gap-4'>
          <div className='rounded-lg bg-primary/10 p-3 text-primary'>
            <Icon className='size-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
            <p className='text-muted-foreground'>{description}</p>
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {summary.map((item) => (
            <Card key={item.label}>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-2xl font-bold'>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Main>
    </>
  )
}
