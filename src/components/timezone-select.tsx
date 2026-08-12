import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { formatTimeZoneLabel, getSupportedTimeZones } from '@/lib/timezones'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type TimezoneSelectProps = {
  id: string
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
}

export function TimezoneSelect({
  id,
  value,
  onValueChange,
  disabled = false,
  required = false,
  placeholder = 'Select a timezone',
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const timeZones = useMemo(() => getSupportedTimeZones(value), [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          aria-required={required}
          disabled={disabled}
          className='w-full justify-between bg-transparent font-normal'
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? formatTimeZoneLabel(value) : placeholder}
          </span>
          <ChevronsUpDown className='shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-(--radix-popover-trigger-width) p-0'
      >
        <Command>
          <CommandInput placeholder='Search timezones…' />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {timeZones.map((timeZone) => (
                <CommandItem
                  key={timeZone}
                  value={`${timeZone} ${formatTimeZoneLabel(timeZone)}`}
                  onSelect={() => {
                    onValueChange(timeZone)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'size-4',
                      value === timeZone ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className='truncate'>
                    {formatTimeZoneLabel(timeZone)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
