import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-accent animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}

function SkeletonAvatar({
  size = 'md',
}: {
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }
  return <Skeleton className={cn('rounded-full', sizes[size])} />
}

function SkeletonBadge() {
  return <Skeleton className="h-5 w-16 rounded-full" />
}

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonBadge }
