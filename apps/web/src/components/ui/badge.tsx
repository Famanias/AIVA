import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary/20 text-red-200 border border-primary/30',
        secondary: 'bg-bg-elevated text-text-secondary border border-border',
        success: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800',
        warning: 'bg-amber-950/70 text-amber-300 border border-amber-800',
        destructive: 'bg-red-950/70 text-red-300 border border-red-800',
        outline: 'text-text-primary border border-border bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
