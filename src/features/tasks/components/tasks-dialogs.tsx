import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ManageTaskOptionsDialog } from './manage-task-options-dialog'
import { TasksImportDialog } from './tasks-import-dialog'
import { TasksMutateDrawer } from './tasks-mutate-drawer'
import { useTasks } from './tasks-provider'

export function TasksDialogs() {
  const { open, setOpen, currentRow, setCurrentRow, deleteTask } = useTasks()
  const [isDeleting, setIsDeleting] = useState(false)

  return (
    <>
      <TasksMutateDrawer
        key='task-create'
        open={open === 'create'}
        onOpenChange={() => setOpen('create')}
      />

      <TasksImportDialog
        key='tasks-import'
        open={open === 'import'}
        onOpenChange={() => setOpen('import')}
      />

      <ManageTaskOptionsDialog
        key='task-manage-options'
        open={open === 'manage-options'}
        onOpenChange={() => setOpen('manage-options')}
      />

      {currentRow && (
        <>
          <TasksMutateDrawer
            key={`task-update-${currentRow.id}`}
            open={open === 'update'}
            onOpenChange={() => {
              setOpen('update')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <ConfirmDialog
            key='task-delete'
            destructive
            open={open === 'delete'}
            isLoading={isDeleting}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={async () => {
              setIsDeleting(true)
              try {
                await deleteTask(currentRow.id)
                toast.success(`Deleted task ${currentRow.id}.`)
                setOpen(null)
                setTimeout(() => {
                  setCurrentRow(null)
                }, 500)
              } catch (error) {
                toast.error(
                  error instanceof ApiError
                    ? error.message
                    : 'Could not delete the task.'
                )
              } finally {
                setIsDeleting(false)
              }
            }}
            className='max-w-md'
            title={`Delete this task: ${currentRow.id} ?`}
            desc={
              <>
                You are about to delete a task with the ID{' '}
                <strong>{currentRow.id}</strong>. <br />
                This action cannot be undone.
              </>
            }
            confirmText='Delete'
          />
        </>
      )}
    </>
  )
}
