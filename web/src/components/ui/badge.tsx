import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        tertiary:
          'border-transparent bg-colors-background-core-strong text-colors-text-persist-light hover:bg-colors-background-core-strong/80',
        // 规范语义色配方：*-500/20 半透明底 + *-700 / dark:*-200 文字
        info: 'border-transparent bg-blue-500/20 text-blue-700 dark:text-blue-200',
        success:
          'border-transparent bg-green-500/20 text-green-700 dark:text-green-200',
        warning:
          'border-transparent bg-yellow-500/20 text-yellow-700 dark:text-yellow-200',
        error:
          'border-transparent bg-red-500/20 text-red-700 dark:text-red-200',
        muted:
          'border-transparent bg-gray-500/20 text-gray-700 dark:text-gray-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
