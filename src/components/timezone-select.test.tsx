import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { Label } from '@/components/ui/label'
import { TimezoneSelect } from './timezone-select'

describe('TimezoneSelect', () => {
  it('shows a stored alias and selects a searched timezone', async () => {
    const onValueChange = vi.fn()
    const screen = await render(
      <div>
        <Label htmlFor='timezone'>Timezone</Label>
        <TimezoneSelect
          id='timezone'
          value='Asia/Kolkata'
          onValueChange={onValueChange}
        />
      </div>
    )

    const trigger = screen.getByRole('combobox', { name: 'Timezone' })
    await expect.element(trigger).toHaveTextContent('Asia/Kolkata')
    await userEvent.click(trigger)
    await userEvent.fill(
      screen.getByPlaceholder('Search timezones…'),
      'New York'
    )
    await userEvent.click(
      screen.getByRole('option', { name: /America\/New York/i })
    )

    expect(onValueChange).toHaveBeenCalledWith('America/New_York')
  })

  it('exposes an empty selectable state without accepting free text', async () => {
    const screen = await render(
      <div>
        <Label htmlFor='timezone'>Timezone</Label>
        <TimezoneSelect id='timezone' value='' onValueChange={vi.fn()} />
      </div>
    )

    await expect
      .element(screen.getByRole('combobox', { name: 'Timezone' }))
      .toHaveTextContent('Select a timezone')
    await expect
      .element(screen.getByRole('textbox', { name: 'Timezone' }))
      .not.toBeInTheDocument()
  })
})
