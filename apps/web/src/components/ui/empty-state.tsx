import * as React from 'react';
import Link from 'next/link';
import { LucideIcon, Film } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Film,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-bg-card/40 backdrop-blur-sm',
        className
      )}
      {...props}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated border border-border text-primary shadow-glow-subtle mb-4">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-display text-heading-md font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="mt-1.5 text-body-sm text-text-muted max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link href={action.href}>
              <Button size="md">{action.label}</Button>
            </Link>
          ) : (
            <Button size="md" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
