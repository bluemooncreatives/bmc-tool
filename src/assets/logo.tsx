import { cn } from '@/lib/utils'

/** Brand mark. Lives in /public so it can also be used as the favicon. */
export const LOGO_SRC = '/images/bmc-logo.png'

export function Logo({
  className,
  alt = 'Blue Moon Creatives Tool',
  ...props
}: React.ComponentProps<'img'>) {
  return (
    <img
      id='bmc-logo'
      src={LOGO_SRC}
      alt={alt}
      width={24}
      height={24}
      className={cn('size-6 object-contain', className)}
      {...props}
    />
  )
}
