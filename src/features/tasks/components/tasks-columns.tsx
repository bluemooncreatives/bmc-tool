import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { type ResolvedTaskOption } from '../data/data'
import { type Task } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

type TasksColumnsOptions = {
  labels: ResolvedTaskOption[]
  statuses: ResolvedTaskOption[]
  priorities: ResolvedTaskOption[]
}

export function getTasksColumns({
  labels,
  statuses,
  priorities,
}: TasksColumnsOptions): ColumnDef<Task>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
          className='translate-y-0.5'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
          className='translate-y-0.5'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Task' />
      ),
      cell: ({ row }) => <div className='w-20'>{row.getValue('id')}</div>,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'label',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Label' />
      ),
      meta: { className: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => {
        const label = labels.find(
          (label) => label.value === row.getValue('label')
        )

        if (!label) {
          return null
        }

        return (
          <div className='flex w-30 items-center'>
            <Badge
              variant='outline'
              className={cn(
                'rounded-md font-normal',
                label.badgeClassName
              )}
            >
              {label.label}
            </Badge>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Title' />
      ),
      meta: {
        className: 'ps-1 max-w-0 w-2/3',
        tdClassName: 'ps-4',
      },
      cell: ({ row }) => (
        <span className='truncate font-medium'>{row.getValue('title')}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Status' />
      ),
      meta: { className: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => {
        const status = statuses.find(
          (status) => status.value === row.getValue('status')
        )

        if (!status) {
          return null
        }

        return (
          <div className='flex w-25 items-center'>
            <Badge
              variant='outline'
              className={cn(
                'gap-1.5 rounded-md font-normal',
                status.badgeClassName
              )}
            >
              {status.icon && <status.icon className='size-3.5' />}
              {status.label}
            </Badge>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'priority',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Priority' />
      ),
      meta: { className: 'ps-1', tdClassName: 'ps-3' },
      cell: ({ row }) => {
        const priority = priorities.find(
          (priority) => priority.value === row.getValue('priority')
        )

        if (!priority) {
          return null
        }

        return (
          <div className='flex items-center'>
            <Badge
              variant='outline'
              className={cn(
                'gap-1.5 rounded-md font-normal',
                priority.badgeClassName
              )}
            >
              {priority.icon && <priority.icon className='size-3.5' />}
              {priority.label}
            </Badge>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
    },
  ]
}
