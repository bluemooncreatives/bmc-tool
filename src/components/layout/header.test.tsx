import '@/styles/index.css'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Header } from './header'

describe('Header layout', () => {
  it('keeps its 4.5rem height when sibling content exceeds the viewport', async () => {
    const screen = await render(
      <SidebarProvider>
        <div className='flex h-40 w-full flex-col overflow-hidden'>
          <Header>
            <span>Topbar content</span>
          </Header>
          <main className='h-96 min-h-96 shrink-0'>Tall route content</main>
        </div>
      </SidebarProvider>
    )

    const header = screen.getByRole('banner')
    await expect.element(header).toBeInTheDocument()
    expect(
      Math.round((await header.element()).getBoundingClientRect().height)
    ).toBe(72)
  })
})
