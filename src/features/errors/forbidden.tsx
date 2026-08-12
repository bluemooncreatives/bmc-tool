import { useNavigate, useRouter } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { isSuperadmin, MODULE_DEFINITIONS } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

export function ForbiddenError() {
  const navigate = useNavigate()
  const { history } = useRouter()
  const { auth } = useAuthStore()
  const fallbackModule = auth.user
    ? isSuperadmin(auth.user)
      ? undefined
      : MODULE_DEFINITIONS.find((module) =>
          auth.user?.modulePermissions?.includes(module.key)
        )
    : undefined
  const fallback = isSuperadmin(auth.user ?? { role: [] })
    ? '/'
    : fallbackModule?.path

  function openFallback() {
    if (fallbackModule?.key === 'tasks_active') {
      navigate({ to: '/tasks', search: { view: 'active' } })
      return
    }
    if (fallback) navigate({ to: fallback })
  }

  async function signOut() {
    await auth.signOut().catch(() => undefined)
    navigate({ to: '/sign-in', replace: true })
  }
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>403</h1>
        <span className='font-medium'>Access Forbidden</span>
        <p className='text-center text-muted-foreground'>
          Your account does not have access to this module. <br />
          Ask the Super Admin to update your module permissions.
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline' onClick={() => history.go(-1)}>
            Go Back
          </Button>
          {fallback ? (
            <Button onClick={openFallback}>Open an allowed module</Button>
          ) : (
            <Button onClick={() => void signOut()}>Return to sign in</Button>
          )}
        </div>
      </div>
    </div>
  )
}
