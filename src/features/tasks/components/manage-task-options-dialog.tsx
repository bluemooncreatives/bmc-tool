import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { COLOR_KEYS, COLOR_PALETTE, type ColorKey } from '../data/color-palette'
import { type TaskOption } from '../data/data'
import { ICON_KEYS, ICONS, type IconKey } from '../data/icons'
import {
  type TaskOptionKind,
  useTaskOptionsStore,
} from '../stores/task-options-store'

type ManageTaskOptionsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const KIND_META: Record<TaskOptionKind, { title: string; noun: string }> = {
  label: { title: 'Labels', noun: 'label' },
  status: { title: 'Statuses', noun: 'status' },
  priority: { title: 'Priorities', noun: 'priority' },
}

export function ManageTaskOptionsDialog({
  open,
  onOpenChange,
}: ManageTaskOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Manage task options</DialogTitle>
          <DialogDescription>
            Add, edit, or remove the custom labels, statuses, and priorities
            available for tasks.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue='label' className='w-full'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='label'>Labels</TabsTrigger>
            <TabsTrigger value='status'>Statuses</TabsTrigger>
            <TabsTrigger value='priority'>Priorities</TabsTrigger>
          </TabsList>
          <TabsContent value='label'>
            <OptionManager kind='label' />
          </TabsContent>
          <TabsContent value='status'>
            <OptionManager kind='status' />
          </TabsContent>
          <TabsContent value='priority'>
            <OptionManager kind='priority' />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function OptionManager({ kind }: { kind: TaskOptionKind }) {
  const options = useTaskOptionsStore((s) =>
    kind === 'label' ? s.labels : kind === 'status' ? s.statuses : s.priorities
  )
  const addOption = useTaskOptionsStore((s) => s.addOption)
  const updateOption = useTaskOptionsStore((s) => s.updateOption)
  const removeOption = useTaskOptionsStore((s) => s.removeOption)
  const noun = KIND_META[kind].noun

  const [editingValue, setEditingValue] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  const [draftIcon, setDraftIcon] = useState<IconKey>('tag')
  const [draftColor, setDraftColor] = useState<ColorKey>('slate')

  const [newLabel, setNewLabel] = useState('')
  const [newIcon, setNewIcon] = useState<IconKey>('tag')
  const [newColor, setNewColor] = useState<ColorKey>('slate')

  function startEdit(option: TaskOption) {
    setEditingValue(option.value)
    setDraftLabel(option.label)
    setDraftIcon(option.icon)
    setDraftColor(option.colorKey)
  }

  function cancelEdit() {
    setEditingValue(null)
  }

  function saveEdit() {
    if (!editingValue) return
    if (!draftLabel.trim()) {
      toast.error('Name is required.')
      return
    }
    updateOption(kind, editingValue, {
      label: draftLabel.trim(),
      icon: draftIcon,
      colorKey: draftColor,
    })
    setEditingValue(null)
  }

  function handleAdd() {
    const trimmed = newLabel.trim()
    if (!trimmed) {
      toast.error('Name is required.')
      return
    }
    const exists = options.some(
      (option) => option.label.toLowerCase() === trimmed.toLowerCase()
    )
    if (exists) {
      toast.error(`A ${noun} named "${trimmed}" already exists.`)
      return
    }
    addOption(kind, { label: trimmed, icon: newIcon, colorKey: newColor })
    setNewLabel('')
    setNewIcon('tag')
    setNewColor('slate')
    toast.success(`Added "${trimmed}" ${noun}.`)
  }

  function handleRemove(option: TaskOption) {
    const removed = removeOption(kind, option.value)
    if (!removed) {
      toast.error(`At least one ${noun} is required.`)
      return
    }
    toast.success(`Removed "${option.label}" ${noun}.`)
  }

  return (
    <div className='space-y-4 py-2'>
      <ScrollArea className='h-64 pe-3'>
        <div className='space-y-2'>
          {options.map((option) => {
            const Icon = ICONS[option.icon]
            const palette = COLOR_PALETTE[option.colorKey]
            const isEditing = editingValue === option.value

            return (
              <div
                key={option.value}
                className='flex items-center gap-2 rounded-md border p-2'
              >
                {isEditing ? (
                  <>
                    <IconPicker value={draftIcon} onChange={setDraftIcon} />
                    <ColorPicker value={draftColor} onChange={setDraftColor} />
                    <Input
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          saveEdit()
                        }
                      }}
                      className='h-8 flex-1'
                      autoFocus
                    />
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-8'
                      aria-label='Save'
                      onClick={saveEdit}
                    >
                      <Check className='size-4' />
                    </Button>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-8'
                      aria-label='Cancel'
                      onClick={cancelEdit}
                    >
                      <X className='size-4' />
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge
                      variant='outline'
                      className={cn(
                        'gap-1.5 rounded-md font-normal',
                        palette.badge
                      )}
                    >
                      <Icon className='size-3.5' />
                      {option.label}
                    </Badge>
                    <span className='flex-1' />
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-8'
                      aria-label={`Edit ${option.label}`}
                      onClick={() => startEdit(option)}
                    >
                      <Pencil className='size-3.5' />
                    </Button>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-8 text-destructive hover:text-destructive'
                      aria-label={`Delete ${option.label}`}
                      onClick={() => handleRemove(option)}
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <div className='flex items-center gap-2 border-t pt-3'>
        <IconPicker value={newIcon} onChange={setNewIcon} />
        <ColorPicker value={newColor} onChange={setNewColor} />
        <Input
          placeholder={`New ${noun} name`}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          className='h-8 flex-1'
        />
        <Button
          type='button'
          size='icon'
          className='size-8'
          aria-label={`Add ${noun}`}
          onClick={handleAdd}
        >
          <Plus className='size-4' />
        </Button>
      </div>
    </div>
  )
}

function IconPicker({
  value,
  onChange,
}: {
  value: IconKey
  onChange: (value: IconKey) => void
}) {
  const Icon = ICONS[value]
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-8 shrink-0'
          aria-label='Choose icon'
        >
          <Icon className='size-4' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-48 p-2' align='start'>
        <div className='grid grid-cols-6 gap-1'>
          {ICON_KEYS.map((key) => {
            const OptionIcon = ICONS[key]
            return (
              <Button
                key={key}
                type='button'
                variant={key === value ? 'secondary' : 'ghost'}
                size='icon'
                className='size-8'
                aria-label={key}
                onClick={() => onChange(key)}
              >
                <OptionIcon className='size-4' />
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ColorPicker({
  value,
  onChange,
}: {
  value: ColorKey
  onChange: (value: ColorKey) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-8 shrink-0'
          aria-label='Choose color'
        >
          <span className={cn('size-4 rounded-full', COLOR_PALETTE[value].swatch)} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-40 p-2' align='start'>
        <div className='grid grid-cols-6 gap-1'>
          {COLOR_KEYS.map((key) => (
            <button
              key={key}
              type='button'
              aria-label={COLOR_PALETTE[key].name}
              onClick={() => onChange(key)}
              className={cn(
                'flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background',
                key === value && 'ring-2 ring-ring'
              )}
            >
              <span
                className={cn('size-5 rounded-full', COLOR_PALETTE[key].swatch)}
              />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
