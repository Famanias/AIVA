import { cn } from './utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-bg-elevated/70 border border-border/50', className)}
      {...props}
    />
  );
}

export { Skeleton };
