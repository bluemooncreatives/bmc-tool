import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SelectDropdown } from '@/components/select-dropdown'
import { resolveOptions } from '../data/data'
import { type Task } from '../data/schema'
import { useTaskOptionsStore } from '../stores/task-options-store'

type TaskMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Task
}

const formSchema = z.object({
  id: z.string().min(1, 'Task number is required.'),
  title: z.string().min(1, 'Title is required.'),
  status: z.string().min(1, 'Please select a status.'),
  label: z.string().min(1, 'Please select a label.'),
  priority: z.string().min(1, 'Please choose a priority.'),
})
type TaskForm = z.infer<typeof formSchema>

function generateTaskNumber() {
  return `TASK-${Math.floor(1000 + Math.random() * 9000)}`
}

export function TasksMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: TaskMutateDrawerProps) {
  const isUpdate = !!currentRow

  const storeLabels = useTaskOptionsStore((s) => s.labels)
  const storeStatuses = useTaskOptionsStore((s) => s.statuses)
  const storePriorities = useTaskOptionsStore((s) => s.priorities)
  const labels = resolveOptions(storeLabels)
  const statuses = resolveOptions(storeStatuses)
  const priorities = resolveOptions(storePriorities)

  const form = useForm<TaskForm>({
    resolver: zodResolver(formSchema),
    defaultValues: currentRow ?? {
      id: generateTaskNumber(),
      title: '',
      status: '',
      label: '',
      priority: '',
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      currentRow ?? {
        id: generateTaskNumber(),
        title: '',
        status: '',
        label: '',
        priority: '',
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentRow])

  const onSubmit = (data: TaskForm) => {
    // do something with the form data
    onOpenChange(false)
    form.reset()
    showSubmittedData(data)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        form.reset()
      }}
    >
      <SheetContent className='flex flex-col'>
        <SheetHeader className='text-start'>
          <SheetTitle>{isUpdate ? 'Update' : 'Create'} Task</SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Update the task by providing necessary info.'
              : 'Add a new task by providing necessary info.'}
            Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='tasks-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex-1 space-y-6 overflow-y-auto px-4'
          >
            <FormField
              control={form.control}
              name='id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='e.g. TASK-1234' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='Enter a title' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='status'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='Select status'
                    items={statuses}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='label'
              render={({ field }) => (
                <FormItem className='relative'>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className='flex flex-col space-y-1'
                    >
                      {labels.map((label) => (
                        <FormItem
                          key={label.value}
                          className='flex items-center'
                        >
                          <FormControl>
                            <RadioGroupItem value={label.value} />
                          </FormControl>
                          <FormLabel className='flex items-center gap-1.5 font-normal'>
                            {label.icon && (
                              <label.icon
                                className={cn('size-4', label.color)}
                              />
                            )}
                            {label.label}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='priority'
              render={({ field }) => (
                <FormItem className='relative'>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className='flex flex-col space-y-1'
                    >
                      {priorities.map((priority) => (
                        <FormItem
                          key={priority.value}
                          className='flex items-center'
                        >
                          <FormControl>
                            <RadioGroupItem value={priority.value} />
                          </FormControl>
                          <FormLabel className='flex items-center gap-1.5 font-normal'>
                            {priority.icon && (
                              <priority.icon
                                className={cn('size-4', priority.color)}
                              />
                            )}
                            {priority.label}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <SheetFooter className='gap-2'>
          <SheetClose asChild>
            <Button variant='outline'>Close</Button>
          </SheetClose>
          <Button form='tasks-form' type='submit'>
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
