import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-fast ease-out ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-page ' +
    'disabled:opacity-50 disabled:pointer-events-none ' +
    'active:scale-[0.98] cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-text-inverse hover:bg-primary-hover shadow-glow-subtle font-semibold',
        secondary: 'bg-bg-elevated text-text-primary border border-border hover:bg-bg-input hover:border-border-strong',
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-input',
        destructive: 'bg-error text-text-inverse hover:bg-red-400 shadow-glow-subtle',
        outline: 'border-2 border-border hover:border-border-strong bg-transparent text-text-primary',
      },
      size: {
        sm: 'h-8 px-3 text-body-sm rounded-md',
        md: 'h-10 px-4 text-body rounded-lg',
        lg: 'h-12 px-6 text-body-lg rounded-xl',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
